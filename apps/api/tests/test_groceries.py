"""Monthly groceries (app/groceries.py): what's due, marking bought, the weekly nudge."""

from datetime import datetime, timedelta, timezone

import pytest

from app import groceries
from app.families import _query
from tests.conftest import as_user

IST = timezone(timedelta(hours=5, minutes=30))
MAA, NANI = "+919876500901", "+919876500999"
NEHA, EVE = "ExponentPushToken[neha]", "ExponentPushToken[eve]"
NOON = datetime.now(IST).replace(hour=12, minute=0, second=0, microsecond=0)


@pytest.fixture
def family(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": NANI, "parent": {"parent_name": "Nani"}})
    for user, token in (("neha", NEHA), ("eve", EVE)):
        client.post("/me/push-tokens", headers=as_user(user), json={"token": token})


def add(client, items, user="neha", phone=MAA):
    return client.post("/me/groceries", headers=as_user(user), json={"phone": phone, "items": items})


def listed(client):
    return client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["groceries"]


def bought_days_ago(name, days):
    _query("UPDATE grocery_items SET last_bought_on = %(d)s WHERE name = %(n)s",
           {"d": (datetime.now(IST) - timedelta(days=days)).date(), "n": name})


def test_new_items_are_due_and_same_name_updates(client, family):
    r = add(client, [{"name": "Atta", "qty": "5 kg"}, {"name": "Tea", "qty": "250 g", "every_days": 14}])
    assert r.status_code == 200
    assert {(x["name"], x["qty"], x["every_days"], x["due"]) for x in r.json()} == {("Atta", "5 kg", 30, True), ("Tea", "250 g", 14, True)}
    add(client, [{"name": "atta", "qty": "10 kg"}])  # same item, any case
    assert [(x["name"], x["qty"]) for x in listed(client) if x["name"].lower() == "atta"] == [("Atta", "10 kg")]
    assert add(client, [{"name": "Rice", "every_days": 45}]).status_code == 422  # weekly .. two-monthly only
    assert add(client, [{"name": "Rice"}], user="eve").status_code == 404


def test_due_follows_the_cycle(client, family):
    add(client, [{"name": "Atta"}, {"name": "Tea", "every_days": 7}, {"name": "Oil", "every_days": 60}])
    bought_days_ago("Atta", 20)  # due in 10 days: not yet
    bought_days_ago("Tea", 5)    # due in 2 days: due soon
    bought_days_ago("Oil", 70)   # 10 days overdue
    by = {x["name"]: x for x in listed(client)}
    assert (by["Atta"]["due"], by["Tea"]["due"], by["Oil"]["due"], by["Oil"]["overdue"]) == (False, True, True, True)
    assert [x["name"] for x in listed(client)][:2] == ["Oil", "Tea"]  # due first, earliest first


def test_mark_bought_restarts_only_those(client, family):
    items = add(client, [{"name": "Atta"}, {"name": "Sugar"}]).json()
    ids = {x["name"]: x["id"] for x in items}
    assert client.post("/me/groceries/bought", headers=as_user("eve"), json={"ids": [ids["Atta"]]}).status_code == 404
    r = client.post("/me/groceries/bought", headers=as_user("neha"), json={"ids": [ids["Atta"]]}).json()
    by = {x["name"]: x for x in r}
    assert by["Atta"]["due"] is False and by["Atta"]["last_bought_on"] == datetime.now(IST).date().isoformat()
    assert by["Sugar"]["due"] is True


def test_edit_and_remove(client, family):
    gid = add(client, [{"name": "Dal", "qty": "1 kg"}]).json()[0]["id"]
    r = client.patch(f"/me/groceries/{gid}", headers=as_user("neha"), json={"qty": "2 kg", "every_days": 14}).json()
    assert (r[0]["qty"], r[0]["every_days"]) == ("2 kg", 14)
    assert client.delete(f"/me/groceries/{gid}", headers=as_user("eve")).status_code == 404
    assert client.delete(f"/me/groceries/{gid}", headers=as_user("neha")).json() == []


def test_weekly_nudge(client, family, expo):
    add(client, [{"name": "Atta"}, {"name": "Rice"}])
    assert groceries.run_alerts(NOON.replace(hour=23)) == 0  # never at night
    assert groceries.run_alerts(NOON) == 1
    assert [m["to"] for m in expo.sent] == [NEHA]
    assert expo.sent[0]["title"] == "Maa's groceries: 2 items due this week"
    assert expo.sent[0]["data"]["screen"] == "groceries"
    assert groceries.run_alerts(NOON) == 0  # once a week
    _query("UPDATE parents SET groceries_alerted_on = groceries_alerted_on - 7")
    assert groceries.run_alerts(NOON) == 1  # a week later, still due: again


def test_nothing_due_no_nudge(client, family, expo):
    add(client, [{"name": "Atta"}])
    bought_days_ago("Atta", 1)
    assert groceries.run_alerts(NOON) == 0 and expo.sent == []


def test_kirana_number_on_the_profile(client, family):
    client.put(f"/me/family/parents/{MAA}", headers=as_user("neha"), json={"parent_name": "Maa", "kirana_phone": "98200 33344"})
    assert client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["kirana_phone"] == "+919820033344"


def test_amazon_product_per_item(client, family):
    gid = add(client, [{"name": "Atta", "qty": "5 kg"}]).json()[0]["id"]
    r = client.put(f"/me/groceries/{gid}/amazon", headers=as_user("neha"), json={"link": "https://www.amazon.in/Aashirvaad-Atta/dp/B00TESTAT1?th=1"})
    assert r.json()[0]["amazon_asin"] == "B00TESTAT1"
    assert client.put(f"/me/groceries/{gid}/amazon", headers=as_user("neha"), json={"link": "https://blinkit.com/prn/atta"}).status_code == 422
    assert client.put(f"/me/groceries/{gid}/amazon", headers=as_user("eve"), json={"link": "B00TESTAT1"}).status_code == 404
    assert client.put(f"/me/groceries/{gid}/amazon", headers=as_user("neha"), json={}).json()[0]["amazon_asin"] is None
