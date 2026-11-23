import * as Notifications from "expo-notifications";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api, ApiError, fromApi } from "./api";
import { pushSupported, registerForPush, unregisterPush } from "./push";
import { asinFromLink, groceryView, istDate, joinMedicines, sampleFamily, stockView, type GroceryItem, sampleFather, to24h, type Family, type Medicine, type Member, type Parent } from "./data";
import { loadSession, shownParent, signOut as endSession } from "./session";

/** "signed-in" = SuperTokens session; "sample" = looking around without an account. */
type Mode = "loading" | "signed-out" | "signed-in" | "sample";
/** For signed-in users: whether their family has loaded, or they still need to set one up. */
type FamilyState = "loading" | "ready" | "none" | "error";

export type ParentEdit = Partial<Pick<Parent, "name" | "avatar" | "city" | "language" | "callTime" | "callLengthMinutes" | "dailyCalls" | "chemistPhone" | "kiranaPhone">> & {
  /** A new mobile number (E.164): everything Kin keeps moves to it. */
  phone?: string;
  /** Topics Kin never brings up on a call (a person, a loss, a dispute). */
  topicsAvoid?: string[];
};
export type NewParent = { name: string; phone: string; avatar?: string; city?: string; language?: string };
export type NewMember = { name: string; avatar?: string; relation: string; city?: string; phone?: string; email?: string; is_emergency: boolean };

/** Who Kin should ring now: the parent, or a family member (by member id). */
export type CallTarget = { name: string; memberId?: string };

/** A call the family asked Kin to place right now, while it runs and just after. `name` = who Kin rings. */
export type LiveCall = { name: string } & (
  | { state: "placing" }
  | { state: "calling" | "connected"; attemptId: string }
  | { state: "done"; attemptId: string; callId: string | null; status: string | null }
  | { state: "timeout"; attemptId: string }
  | { state: "failed"; message: string }
);

const POLL_MS = 4000;

type Kin = {
  mode: Mode;
  email: string;
  family: Family;
  familyState: FamilyState;
  error: string;
  refreshing: boolean;
  signedIn: (email: string) => void;
  trySample: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  setupFamily: (body: unknown) => Promise<void>;
  saveParent: (edit: ParentEdit) => Promise<void>;
  /** Show another of the family's parents on every screen. */
  switchParent: (phone: string) => Promise<void>;
  /** Add a second parent (e.g. father as well as mother); returns their number as the API saved it. */
  addParent: (p: NewParent) => Promise<void>;
  saveMedicines: (meds: Medicine[]) => Promise<void>;
  setStock: (s: { name: string; perDay: number; packSize: number; tablets: number; courseDays?: number | null }) => Promise<void>;
  restock: (id: string, packs: number) => Promise<void>;
  restockAll: (items: { id: string; packs: number }[]) => Promise<void>;
  addGroceries: (items: { name: string; qty?: string | null; everyDays?: number }[]) => Promise<void>;
  updateGrocery: (id: string, patch: { name?: string; qty?: string | null; everyDays?: number }) => Promise<void>;
  removeGrocery: (id: string) => Promise<void>;
  groceriesBought: (ids: string[]) => Promise<void>;
  setGroceryAmazon: (id: string, link: string | null) => Promise<void>;
  saveProduct: (name: string, link: string | null) => Promise<void>;
  saveReminder: (r: { id?: string; time?: string; medicines?: string; enabled?: boolean }) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
  addMember: (m: NewMember) => Promise<void>;
  updateMember: (id: string, m: NewMember) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  sendMessage: (text: string, replyTo?: string) => Promise<void>;
  markMessageDone: (id: string) => Promise<void>;
  markUrgentHandled: (id: string) => Promise<void>;
  liveCall: LiveCall | null;
  callNow: (target: CallTarget) => Promise<void>;
  dismissLiveCall: () => void;
};

const KinContext = createContext<Kin | null>(null);

export function KinProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [family, setFamily] = useState<Family>(sampleFamily);
  const [familyState, setFamilyState] = useState<FamilyState>("loading");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [liveCall, setLiveCall] = useState<LiveCall | null>(null);
  const shown = useRef<string | null>(null); // the picked parent's phone; read by load()

  // Back to the sign-in screen with nothing of the family left in memory.
  const endLocal = useCallback(async () => {
    await endSession();
    setLiveCall(null);
    shown.current = null;
    await shownParent.set(null);
    setEmail("");
    setFamily(sampleFamily);
    setFamilyState("loading");
    setMode("signed-out");
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush(); // needs the session, so before it ends
    await endLocal();
  }, [endLocal]);

  const load = useCallback(async () => {
    try {
      const f = await api.family();
      if (shown.current === null) shown.current = await shownParent.get();
      const parent = f.parents.find((p) => p.phone === shown.current) ?? f.parents[0];
      const [calls, messages] = parent ? await Promise.all([api.calls(parent.phone), api.messages()]) : [[], []];
      const view = fromApi(f, calls, messages, parent?.phone);
      if (!view) {
        setFamilyState("none");
        return;
      }
      setFamily(view);
      setFamilyState("ready");
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setFamilyState("none");
      else if (e instanceof ApiError && e.status === 401) await signOut();
      else {
        setError(e instanceof Error ? e.message : "Could not load your family.");
        setFamilyState((s) => (s === "ready" ? s : "error"));
      }
    }
  }, [signOut]);

  useEffect(() => {
    loadSession()
      .then((s) => {
        if (s) {
          setEmail(s.email);
          setMode("signed-in");
        } else setMode("signed-out");
      })
      .catch(() => setMode("signed-out"));
  }, []);

  useEffect(() => {
    if (mode === "signed-in") load();
  }, [mode, load]);

  // Pushes: register this phone once the family exists (the API files tokens by family).
  const registered = useRef(false);
  useEffect(() => {
    if (mode !== "signed-in") registered.current = false;
    else if (familyState === "ready" && !registered.current) {
      registered.current = true;
      registerForPush();
    }
  }, [mode, familyState]);

  // A push means a call just ended: reload so the new card is already there.
  useEffect(() => {
    if (!pushSupported || mode !== "signed-in") return;
    const sub = Notifications.addNotificationReceivedListener(() => load());
    return () => sub.remove();
  }, [mode, load]);

  // While tonight's daily call is ringing or retrying, keep its status fresh.
  const dailyBusy = family.parent.daily?.state === "calling" || family.parent.daily?.state === "retrying";
  useEffect(() => {
    if (mode !== "signed-in" || !dailyBusy) return;
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [mode, dailyBusy, load]);

  const refresh = useCallback(async () => {
    if (mode !== "signed-in") return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [mode, load]);

  const signedIn = useCallback((e: string) => {
    setEmail(e);
    setFamilyState("loading");
    setMode("signed-in");
  }, []);
  const trySample = useCallback(() => {
    setFamily(sampleFamily);
    setMode("sample");
  }, []);

  const setupFamily = useCallback(
    async (body: unknown) => {
      await api.createFamily(body);
      await load();
    },
    [load],
  );

  // Edits: in sample mode they only change the local copy; signed in they go
  // to the API first, then the family is reloaded so every screen agrees.
  const saveParent = useCallback(
    async (edit: ParentEdit) => {
      if (mode !== "signed-in") {
        const { topicsAvoid, ...parent } = edit;
        const old = family.parent.phone;
        setFamily((f) => ({
          ...f,
          parent: { ...f.parent, ...parent },
          parents: f.parents.map((x) => (x.phone === old ? { ...x, phone: parent.phone ?? x.phone, name: parent.name ?? x.name } : x)),
          ...(topicsAvoid && { topicsAvoid }),
        }));
        return;
      }
      await api.putParent(family.parent.phone, {
        parent_name: edit.name ?? family.parent.name,
        // The API keeps one comma-separated line (max 200 characters); api.ts splits it again.
        ...(edit.topicsAvoid && { topics_avoid: edit.topicsAvoid.join(", ") }),
        ...(edit.city !== undefined && { city: edit.city }),
        ...(edit.language && { language: edit.language }),
        ...(edit.callTime && { call_time: to24h(edit.callTime) }),
        ...(edit.callLengthMinutes && { call_length_minutes: edit.callLengthMinutes }),
        ...(edit.dailyCalls !== undefined && { daily_calls: edit.dailyCalls }),
        ...("avatar" in edit && { avatar: edit.avatar ?? null }),
        ...("chemistPhone" in edit && { chemist_phone: edit.chemistPhone || null }),
        ...("kiranaPhone" in edit && { kirana_phone: edit.kiranaPhone || null }),
      });
      if (edit.phone && edit.phone !== family.parent.phone) {
        const { phone } = await api.changeParentPhone(family.parent.phone, edit.phone);
        shown.current = phone;
        await shownParent.set(phone);
      }
      await load();
    },
    [mode, family.parent, load],
  );

  const switchParent = useCallback(
    async (phone: string) => {
      if (mode !== "signed-in") {
        setFamily(phone === sampleFather.parent.phone ? sampleFather : sampleFamily);
        return;
      }
      shown.current = phone;
      await shownParent.set(phone);
      setRefreshing(true);
      await load();
      setRefreshing(false);
    },
    [mode, load],
  );

  const addParent = useCallback(
    async (p: NewParent) => {
      if (mode !== "signed-in") throw new Error("Sign in to add a parent.");
      const { phone } = await api.putParent(p.phone, {
        parent_name: p.name,
        ...(p.city && { city: p.city }),
        ...(p.language && { language: p.language }),
        ...(p.avatar && { avatar: p.avatar }),
      });
      await switchParent(phone);
    },
    [mode, switchParent],
  );

  const saveMedicines = useCallback(
    async (meds: Medicine[]) => {
      // A medicine taken off the list stops counting stock (no refill alert, not in Restock all).
      const names = new Set(meds.map((m) => m.name.toLowerCase()));
      const dropped = (family.parent.stock ?? []).filter((s) => !names.has(s.name.toLowerCase()));
      if (mode !== "signed-in") {
        setFamily((f) => ({ ...f, medicines: meds, parent: { ...f.parent, stock: (f.parent.stock ?? []).filter((s) => names.has(s.name.toLowerCase())) } }));
        return;
      }
      await api.putParent(family.parent.phone, { parent_name: family.parent.name, medicines: joinMedicines(meds) });
      await Promise.all(dropped.map((s) => api.deleteStock(s.id)));
      await load();
    },
    [mode, family.parent, load],
  );

  // Medicine stock (apps/api/app/stock.py): count a medicine (courseDays: a set prescription,
  // none = ongoing), or add bought strips to one or several.
  const setStock = useCallback(
    async ({ name, perDay, packSize, tablets, courseDays }: { name: string; perDay: number; packSize: number; tablets: number; courseDays?: number | null }) => {
      const courseEndsOn = courseDays ? istDate(new Date(Date.now() + (courseDays - 1) * 86400000)) : null;
      if (mode !== "signed-in") {
        setFamily((f) => {
          const item = stockView({ id: `s${Date.now()}`, name, perDay, packSize, left: tablets, courseEndsOn });
          const rest = (f.parent.stock ?? []).filter((x) => x.name.toLowerCase() !== name.toLowerCase());
          return { ...f, parent: { ...f.parent, stock: [...rest, item] } };
        });
        return;
      }
      await api.setStock({ phone: family.parent.phone, name, per_day: perDay, pack_size: packSize, tablets, course_ends_on: courseEndsOn });
      await load();
    },
    [mode, family.parent.phone, load],
  );

  const restockAll = useCallback(
    async (items: { id: string; packs: number }[]) => {
      const todo = items.filter((i) => i.packs > 0);
      if (!todo.length) return;
      if (mode !== "signed-in") {
        setFamily((f) => ({
          ...f,
          parent: {
            ...f.parent,
            stock: (f.parent.stock ?? []).map((x) => {
              const add = todo.find((i) => i.id === x.id);
              return add ? stockView({ ...x, left: x.left + add.packs * x.packSize }) : x;
            }),
          },
        }));
        return;
      }
      await api.restockAll(todo.map((i) => ({ id: Number(i.id), packs: i.packs })));
      await load();
    },
    [mode, load],
  );

  const restock = useCallback(async (id: string, packs: number) => restockAll([{ id, packs }]), [restockAll]);

  // Monthly groceries (apps/api/app/groceries.py). Look around keeps them in memory with the same rules.
  const editGroceries = useCallback(
    (fn: (list: GroceryItem[]) => GroceryItem[]) =>
      setFamily((f) => ({
        ...f,
        parent: {
          ...f.parent,
          groceries: fn(f.parent.groceries ?? [])
            .map((g) => groceryView(g))
            .sort((a, b) => Number(b.due) - Number(a.due) || a.dueOn.localeCompare(b.dueOn)),
        },
      })),
    [],
  );

  const addGroceries = useCallback(
    async (items: { name: string; qty?: string | null; everyDays?: number }[]) => {
      if (mode !== "signed-in") {
        editGroceries((list) => {
          const rest = list.filter((g) => !items.some((i) => i.name.toLowerCase() === g.name.toLowerCase()));
          const added = items.map((i, k) => {
            const old = list.find((g) => g.name.toLowerCase() === i.name.toLowerCase());
            return groceryView({ id: old?.id ?? `g${Date.now()}-${k}`, name: old?.name ?? i.name, qty: i.qty ?? null, everyDays: i.everyDays ?? 30, lastBoughtOn: old?.lastBoughtOn ?? null });
          });
          return [...rest, ...added];
        });
        return;
      }
      await api.addGroceries(family.parent.phone, items.map((i) => ({ name: i.name, qty: i.qty ?? null, every_days: i.everyDays ?? 30 })));
      await load();
    },
    [mode, family.parent.phone, load, editGroceries],
  );

  const updateGrocery = useCallback(
    async (id: string, patch: { name?: string; qty?: string | null; everyDays?: number }) => {
      if (mode !== "signed-in") {
        editGroceries((list) => list.map((g) => (g.id === id ? groceryView({ ...g, ...patch }) : g)));
        return;
      }
      await api.updateGrocery(id, { name: patch.name, qty: patch.qty, every_days: patch.everyDays });
      await load();
    },
    [mode, load, editGroceries],
  );

  const removeGrocery = useCallback(
    async (id: string) => {
      if (mode !== "signed-in") {
        editGroceries((list) => list.filter((g) => g.id !== id));
        return;
      }
      await api.deleteGrocery(id);
      await load();
    },
    [mode, load, editGroceries],
  );

  const groceriesBought = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      if (mode !== "signed-in") {
        editGroceries((list) => list.map((g) => (ids.includes(g.id) ? { ...g, lastBoughtOn: istDate() } : g)));
        return;
      }
      await api.groceriesBought(ids);
      await load();
    },
    [mode, load, editGroceries],
  );

  // A grocery's Amazon product (apps/api/app/groceries.py set_amazon); the API reads the ID from the link.
  const setGroceryAmazon = useCallback(
    async (id: string, link: string | null) => {
      if (mode !== "signed-in") {
        const asin = link ? asinFromLink(link) : null;
        if (link && !asin) throw new Error("Paste the link from the item's page on Amazon.");
        editGroceries((list) => list.map((g) => (g.id === id ? { ...g, amazonAsin: asin } : g)));
        return;
      }
      await api.setGroceryAmazon(id, link);
      await load();
    },
    [mode, load, editGroceries],
  );

  // A medicine's Amazon product (apps/api/app/stock.py set_product); the API reads the ID from the link.
  const saveProduct = useCallback(
    async (name: string, link: string | null) => {
      if (mode !== "signed-in") {
        const asin = link ? (/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/.exec(link)?.[1] ?? (/^[A-Z0-9]{10}$/.test(link.trim()) ? link.trim() : null)) : null;
        if (link && !asin) throw new Error("Paste the link from the medicine's page on Amazon.");
        setFamily((f) => {
          const rest = (f.parent.products ?? []).filter((x) => x.name.toLowerCase() !== name.toLowerCase());
          return { ...f, parent: { ...f.parent, products: asin ? [...rest, { name, amazonAsin: asin }] : rest } };
        });
        return;
      }
      await api.setProduct({ phone: family.parent.phone, name, link });
      await load();
    },
    [mode, family.parent.phone, load],
  );

  // Medicine reminder calls (apps/api/app/reminders.py): add (no id) or change one.
  const saveReminder = useCallback(
    async ({ id, ...fields }: { id?: string; time?: string; medicines?: string; enabled?: boolean }) => {
      if (mode !== "signed-in") {
        setFamily((f) => {
          const list = f.parent.reminders ?? [];
          const next = id
            ? list.map((r) => (r.id === id ? { ...r, ...fields } : r))
            : [...list, { id: `r${Date.now()}`, time: fields.time ?? "20:00", medicines: fields.medicines ?? "", enabled: true }];
          return { ...f, parent: { ...f.parent, reminders: next.sort((a, b) => a.time.localeCompare(b.time)) } };
        });
        return;
      }
      if (id) await api.updateReminder(id, fields);
      else await api.addReminder({ phone: family.parent.phone, time: fields.time ?? "20:00", medicines: fields.medicines ?? "" });
      await load();
    },
    [mode, family.parent.phone, load],
  );

  const removeReminder = useCallback(
    async (id: string) => {
      if (mode !== "signed-in") {
        setFamily((f) => ({ ...f, parent: { ...f.parent, reminders: (f.parent.reminders ?? []).filter((r) => r.id !== id) } }));
        return;
      }
      await api.deleteReminder(id);
      await load();
    },
    [mode, load],
  );

  // Sample mode: the same rules as the API (one red alert contact; the owner stays the owner).
  const localMember = (m: NewMember, id: string, old?: Member): Member => ({
    ...old,
    id,
    ...m,
    city: m.city ?? "",
    role: old?.role === "Owner" ? "Owner" : m.is_emergency ? "Red alerts" : /doctor/i.test(m.relation) ? "Teleconsult" : undefined,
  });
  const clearEmergency = (x: Member): Member => ({ ...x, is_emergency: false, role: x.role === "Red alerts" ? undefined : x.role });

  const addMember = useCallback(
    async (m: NewMember) => {
      if (mode !== "signed-in") {
        setFamily((f) => ({
          ...f,
          members: [...f.members.map((x) => (m.is_emergency ? clearEmergency(x) : x)), localMember(m, `m${Date.now()}`)],
        }));
        return;
      }
      await api.addMember(m);
      await load();
    },
    [mode, load],
  );

  const updateMember = useCallback(
    async (id: string, m: NewMember) => {
      if (mode !== "signed-in") {
        setFamily((f) => ({
          ...f,
          members: f.members.map((x) => (x.id === id ? localMember(m, id, x) : m.is_emergency ? clearEmergency(x) : x)),
        }));
        return;
      }
      // null clears a field the user emptied (leaving it out would keep the old value).
      await api.updateMember(id, {
        name: m.name,
        relation: m.relation,
        city: m.city ?? null,
        phone: m.phone ?? null,
        email: m.email ?? null,
        is_emergency: m.is_emergency,
        avatar: m.avatar ?? null,
      });
      await load();
    },
    [mode, load],
  );

  const removeMember = useCallback(
    async (id: string) => {
      if (mode !== "signed-in") {
        setFamily((f) => ({ ...f, members: f.members.filter((x) => x.id !== id) }));
        return;
      }
      await api.deleteMember(id);
      await load();
    },
    [mode, load],
  );

  // "Tell my family": the parent's messages from calls, and notes Kin passes on next call.
  const markMessageDone = useCallback(
    async (id: string) => {
      if (mode !== "signed-in") {
        setFamily((f) => ({ ...f, messages: f.messages.map((m) => (m.id === id ? { ...m, done: true, doneBy: "You" } : m)) }));
        return;
      }
      await api.messageDone(Number(id));
      await load();
    },
    [mode, load],
  );

  const sendMessage = useCallback(
    async (text: string, replyTo?: string) => {
      if (mode !== "signed-in") {
        setFamily((f) => ({
          ...f,
          messages: [
            { id: `s-${Date.now()}`, direction: "to_parent", text, parentName: f.parent.name, fromName: "You", createdAt: new Date().toISOString(), done: false, delivered: false },
            ...f.messages.map((m) => (m.id === replyTo ? { ...m, done: true, doneBy: "You" } : m)),
          ],
        }));
        return;
      }
      await api.sendMessage(text, replyTo ? Number(replyTo) : undefined, family.parent.phone);
      await load();
    },
    [mode, load, family.parent.phone],
  );

  // An emergency Kin flagged mid-call: someone in the family dealt with it.
  const markUrgentHandled = useCallback(
    async (id: string) => {
      if (mode !== "signed-in") {
        setFamily((f) => ({ ...f, parent: { ...f.parent, urgent: undefined } }));
        return;
      }
      await api.urgentHandled(id);
      await load();
    },
    [mode, load],
  );

  // "Call now": a real Sarvam call. Signed in only; the screens send sample users to sign in.
  const callNow = useCallback(
    async ({ name, memberId }: CallTarget) => {
      if (mode !== "signed-in") return;
      setLiveCall({ state: "placing", name });
      try {
        const { attempt_id } = memberId ? await api.callMember(memberId) : await api.callNow(family.parent.phone);
        setLiveCall({ state: "calling", attemptId: attempt_id, name });
      } catch (e) {
        setLiveCall({ state: "failed", message: e instanceof Error ? e.message : "Kin could not place the call.", name });
      }
    },
    [mode, family.parent.phone],
  );

  // Settings → Delete my account: the API removes the data and the sign-in (and this phone's push token).
  const deleteAccount = useCallback(async () => {
    await api.deleteMe();
    await endLocal();
  }, [endLocal]);

  const dismissLiveCall = useCallback(() => setLiveCall(null), []);

  const pollingId = liveCall && (liveCall.state === "calling" || liveCall.state === "connected") ? liveCall.attemptId : null;
  const pollingName = liveCall?.name ?? "";
  useEffect(() => {
    if (!pollingId) return;
    let alive = true;
    const name = pollingName;
    const timer = setInterval(async () => {
      try {
        const a = await api.attempt(pollingId);
        if (!alive) return;
        if (a.state === "done") {
          setLiveCall({ state: "done", attemptId: pollingId, callId: a.call_id === null ? null : String(a.call_id), status: a.status, name });
          await load(); // the new call and its card
        } else setLiveCall({ state: a.state, attemptId: pollingId, name });
      } catch {
        // A dropped poll is fine; the next one tries again.
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pollingId, pollingName, load]);

  const value = useMemo(
    () => ({
      mode, email, family, familyState, error, refreshing, signedIn, trySample, signOut, deleteAccount, refresh, setupFamily, saveParent,
      switchParent, addParent, saveMedicines, setStock, restock, restockAll, addGroceries, updateGrocery, removeGrocery, groceriesBought, setGroceryAmazon, saveProduct, saveReminder, removeReminder, addMember, updateMember, removeMember, sendMessage, markMessageDone, markUrgentHandled,
      liveCall, callNow, dismissLiveCall,
    }),
    [
      mode, email, family, familyState, error, refreshing, signedIn, trySample, signOut, deleteAccount, refresh, setupFamily, saveParent,
      switchParent, addParent, saveMedicines, setStock, restock, restockAll, addGroceries, updateGrocery, removeGrocery, groceriesBought, setGroceryAmazon, saveProduct, saveReminder, removeReminder, addMember, updateMember, removeMember, sendMessage, markMessageDone, markUrgentHandled,
      liveCall, callNow, dismissLiveCall,
    ],
  );
  return <KinContext.Provider value={value}>{children}</KinContext.Provider>;
}

export function useKin() {
  const k = useContext(KinContext);
  if (!k) throw new Error("useKin outside KinProvider");
  return k;
}
