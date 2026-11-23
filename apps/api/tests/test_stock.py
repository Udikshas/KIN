"""Medicine stock (app/stock.py): tablets left, refill alerts, restocking."""

from datetime import datetime, timedelta, timezone

import pytest

from app import stock
from app.families import _query
from tests.conftest import as_user

IST = timezone(timedelta(hours=5, minutes=30))
MAA, NANI = "+919876500801", "+919876500899"
NEHA, EVE = "ExponentPushToken[neha]", "ExponentPushToken[eve]"
NOON = datetime.now(IST).replace(hour=12, minute=0, second=0, microsecond=0)  # today, inside alert hours


@pytest.fixture
def family(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": NANI, "parent": {"parent_name": "Nani"}})
    for user, token in (("neha", NEHA), ("eve", EVE)):
        client.post("/me/push-tokens", headers=as_user(user), json={"token": token})


def put(client, name="Amlodipine 5 mg", per_day=1, pack=10, tablets=20, user="neha", phone=MAA):
    return client.put("/me/stock", headers=as_user(user), json={"phone": phone, "name": name, "per_day": per_day, "pack_size": pack, "tablets": tablets})


def listed(client):
    return client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["stock"]


def age(days):
    _query("UPDATE medicine_stock SET stock_at = stock_at - make_interval(secs => %(s)s)", {"s": days * 86400})


def test_counts_down_by_the_day(client, family):
    s = put(client, tablets=20, per_day=2).json()
    assert (s["left"], s["days_left"], s["low"]) == (20, 10, False)
    age(3)
    s = listed(client)[0]
    assert (s["left"], s["days_left"], s["low"]) == (14, 7, False)
    age(3)
    assert listed(client)[0]["low"] is True  # 8 left at 2 a day: 4 days


def test_same_name_updates_and_checks(client, family):
    put(client, tablets=5)
    put(client, name="amlodipine 5 MG", tablets=30)  # same medicine, any case
    assert [(s["name"], s["left"]) for s in listed(client)] == [("amlodipine 5 MG", 30)]
    assert put(client, user="eve").status_code == 404  # not her parent
    assert put(client, per_day=0).status_code == 422
    assert put(client, pack=0).status_code == 422


def test_restock_adds_to_what_is_left(client, family):
    sid = put(client, tablets=10, per_day=1, pack=10).json()["id"]
    age(7)  # 3 left
    s = client.post(f"/me/stock/{sid}/restock", headers=as_user("neha"), json={"packs": 2}).json()
    assert s["left"] == 23
    assert client.post(f"/me/stock/{sid}/restock", headers=as_user("neha"), json={}).status_code == 422
    assert client.post(f"/me/stock/{sid}/restock", headers=as_user("eve"), json={"packs": 1}).status_code == 404
    assert client.delete(f"/me/stock/{sid}", headers=as_user("eve")).status_code == 404
    assert client.delete(f"/me/stock/{sid}", headers=as_user("neha")).status_code == 200
    assert listed(client) == []


def test_refill_alert_once_then_again_after_restock(client, family, expo):
    sid = put(client, tablets=4, per_day=1).json()["id"]
    put(client, name="Metformin", tablets=60, per_day=2)  # 30 days: fine
    assert stock.run_refill_alerts(NOON) == 1
    assert [m["to"] for m in expo.sent] == [NEHA]  # Maa's family only
    assert expo.sent[0]["title"].startswith("Maa's Amlodipine 5 mg runs out in about ")
    assert expo.sent[0]["data"]["screen"] == "medicines"
    assert stock.run_refill_alerts(NOON) == 0  # once per stock level
    client.post(f"/me/stock/{sid}/restock", headers=as_user("neha"), json={"tablets": 1})  # still low
    assert stock.run_refill_alerts(NOON) == 1  # a new level: told again


def test_quiet_at_night_and_ran_out(client, family, expo):
    put(client, tablets=1, per_day=1)
    assert stock.run_refill_alerts(NOON.replace(hour=23, minute=30)) == 0
    age(3)
    assert stock.run_refill_alerts(NOON) == 1
    assert expo.sent[-1]["title"] == "Maa's Amlodipine 5 mg has run out"


def test_chemist_number_on_the_profile(client, family):
    r = client.put(f"/me/family/parents/{MAA}", headers=as_user("neha"), json={"parent_name": "Maa", "chemist_phone": "12"})
    assert r.status_code == 422
    client.put(f"/me/family/parents/{MAA}", headers=as_user("neha"), json={"parent_name": "Maa", "chemist_phone": "98200 11122"})
    assert client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["chemist_phone"] == "+919820011122"


# ---- Amazon products, for one "add all to cart" link ------------------------------------

@pytest.mark.parametrize("link", [
    "https://www.amazon.in/Amlodipine-Tablet/dp/B07XYZ1234?ref=x",
    "https://www.amazon.in/gp/product/B07XYZ1234/",
    "amazon.in/dp/B07XYZ1234",
    "https://www.amazon.in/gp/aw/d/B07XYZ1234",
    "B07XYZ1234",
])
def test_asin_from_links(link):
    assert stock.asin_from(link) == "B07XYZ1234"


def test_short_share_link_is_followed_once(monkeypatch):
    class _Res:
        headers = {"location": "https://www.amazon.in/Calcium-D3/dp/B08ABCDEFG?_encoding=UTF8"}

    seen = []
    monkeypatch.setattr(stock.httpx, "get", lambda url, **kw: seen.append((url, kw["follow_redirects"])) or _Res())
    assert stock.asin_from("https://amzn.in/d/aBcDeF1") == "B08ABCDEFG"
    assert seen == [("https://amzn.in/d/aBcDeF1", False)]


@pytest.mark.parametrize("link", ["https://www.1mg.com/drugs/amlodipine-5mg", "https://www.amazon.in/s?k=amlodipine", "hello"])
def test_not_a_product_link(link):
    with pytest.raises(stock.BadLink):
        stock.asin_from(link)


def test_save_and_forget_a_product(client, family):
    put_p = lambda link, user="neha": client.put("/me/medicine-products", headers=as_user(user),  # noqa: E731
                                               json={"phone": MAA, "name": "Amlodipine 5 mg", "link": link})
    assert put_p("https://www.amazon.in/x/dp/B07XYZ1234").json() == {"product": {"name": "Amlodipine 5 mg", "amazon_asin": "B07XYZ1234"}}
    assert put_p("https://www.amazon.in/x/dp/B07XYZ9999").status_code == 200  # replaced
    products = client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["products"]
    assert products == [{"name": "Amlodipine 5 mg", "amazon_asin": "B07XYZ9999"}]
    assert put_p("https://www.1mg.com/drugs/x").status_code == 422
    assert put_p("https://www.amazon.in/x/dp/B07XYZ1234", user="eve").status_code == 404  # not her parent
    assert put_p(None).json() == {"product": None}
    assert client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["products"] == []


# ---- courses: never restock past the end of a prescription ---------------------------------

def put_course(client, tablets, days_left_in_course, per_day=1, pack=10, name="Azithromycin 500 mg"):
    ends = (datetime.now(IST) + timedelta(days=days_left_in_course)).date().isoformat()
    return client.put("/me/stock", headers=as_user("neha"), json={"phone": MAA, "name": name, "per_day": per_day, "pack_size": pack,
                                                                  "tablets": tablets, "course_ends_on": ends})


def test_a_course_that_will_last_is_not_low(client, family, expo):
    s = put_course(client, tablets=3, days_left_in_course=2).json()  # today + 2 more days = 3 tablets: enough
    assert (s["low"], s["enough_for_course"], s["suggested_strips"]) == (False, True, 0)
    assert stock.run_refill_alerts(NOON) == 0 and expo.sent == []


def test_a_course_short_of_tablets_suggests_only_what_finishes_it(client, family):
    s = put_course(client, tablets=2, days_left_in_course=4, pack=10).json()  # 5 days to cover, 2 at home: 3 short
    assert (s["low"], s["enough_for_course"], s["suggested_strips"]) == (True, False, 1)  # one strip, not a month
    ongoing = put(client, name="Metformin", tablets=4, per_day=2, pack=15).json()  # a month = 60, 4 at home
    assert ongoing["suggested_strips"] == 4 and ongoing["course_ends_on"] is None


def test_a_finished_course_never_alerts(client, family, expo):
    s = put_course(client, tablets=0, days_left_in_course=-1).json()
    assert (s["course_done"], s["low"], s["suggested_strips"]) == (True, False, 0)
    assert stock.run_refill_alerts(NOON) == 0


def test_restock_all(client, family):
    a = put(client, name="Amlodipine", tablets=2, pack=10).json()["id"]
    b = put(client, name="Calcium", tablets=1, pack=15).json()["id"]
    r = client.post("/me/stock/restock", headers=as_user("neha"), json={"items": [{"id": a, "packs": 2}, {"id": b, "packs": 1}, {"id": b, "packs": 0}]})
    assert sorted((x["name"], x["left"]) for x in r.json()) == [("Amlodipine", 22), ("Calcium", 16)]
    assert client.post("/me/stock/restock", headers=as_user("eve"), json={"items": [{"id": a, "packs": 1}]}).status_code == 404
    assert [s["left"] for s in listed(client) if s["name"] == "Amlodipine"] == [22]  # nothing changed by Eve's try
