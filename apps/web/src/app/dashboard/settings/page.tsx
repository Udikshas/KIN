"use client";

import { useState } from "react";

import { Button, ButtonLink, Card, CardTitle, ErrorText, Input, Modal, PageHead } from "@/components/dashboard/ui";
import { kinNumber } from "@/lib/kin/data";
import { useKin } from "@/lib/kin/kin";

/** Account (apps/mobile/src/app/settings.tsx): who is signed in, sign out, delete the account. */
export default function Settings() {
  const { mode, email, family, signOut, deleteAccount } = useKin();
  const sample = mode === "sample";
  const owner = family.members.find((m) => m.id === family.meId)?.role === "Owner";
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the account.");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead kicker="Account" title="Settings" />
      <div className="grid max-w-[920px] grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Signed in</CardTitle>
          <p className="text-[17px] font-semibold">{sample ? "Sample family" : email || "Your account"}</p>
          <p className="mt-1 text-[14px] leading-[1.5] text-body">
            {sample ? "Nothing you change here is saved." : `The same account as the Kin app. ${family.name}, ${family.members.length} ${family.members.length === 1 ? "person" : "people"}.`}
          </p>
          <Button variant={sample ? "filled" : "soft"} className="mt-4" onClick={signOut}>
            {sample ? "Sign in" : "Sign out"}
          </Button>
        </Card>
        <Card>
          <CardTitle>Kin</CardTitle>
          <div className="space-y-1.5 text-[14px] text-body">
            <p>
              Kin&apos;s number: <span className="font-semibold text-ink tabular-nums">{kinNumber}</span>
            </p>
            <p>Notifications come to the Kin app on your phone. This dashboard refreshes every minute while it&apos;s open.</p>
            <p>Kin is not an emergency service. In India call 108, in Singapore call 995.</p>
          </div>
          <ButtonLink href="/impact" variant="white" size="sm" className="mt-4">
            Kin so far
          </ButtonLink>
        </Card>
        {!sample ? (
          <Card tone="white" className="md:col-span-2">
            <CardTitle>{owner ? "Delete my account and family data" : "Leave the family"}</CardTitle>
            <p className="text-[14px] leading-[1.55] text-body">
              {owner
                ? "Deletes the whole family: parents, calls, alerts, medicines, groceries, members and their sign-ins to this family. Kin stops calling at once. This can't be undone."
                : "Removes you from the family and deletes your sign-in. The family's calls and data stay for the others."}
            </p>
            <Button variant="danger" className="mt-4" onClick={() => setAsking(true)}>
              {owner ? "Delete everything" : "Leave and delete my account"}
            </Button>
          </Card>
        ) : null}
      </div>
      <Modal open={asking} onClose={() => setAsking(false)} title={owner ? "Delete the whole family?" : "Leave the family?"}>
        <div className="space-y-4">
          <p className="text-[15px] leading-[1.5] text-body">{owner ? `Type DELETE to remove ${family.name} and everything Kin keeps about them.` : "Type DELETE to leave and delete your sign-in."}</p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" autoFocus />
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || typed.trim() !== "DELETE"} onClick={remove}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
