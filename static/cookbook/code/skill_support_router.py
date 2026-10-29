"""Fastbite support router, built by a coding agent with the Valen skill.

The agent wrote questions.py, valen_client.py and solution.py from a one-page brief; this file joins
them unchanged and adds a command line. Valen makes the judgments; decide() applies the labeling rules.

python skill_support_router.py --message "Order was late AND they forgot my drink" --order-status delivered
"""

import argparse
import contextlib
import json
import time
import urllib.error
import urllib.request

# questions.py: all Valen question wording, versioned with the model ID.

MODEL = "valen-4b"
QUESTION_SET_VERSION = "v3"

CONTEXT = ("In-app support message from a customer of Fastbite, a food-delivery app in Singapore. "
           "Customers write in English or Chinese.")

QUEUE_CRITERIA = {
    "late_order": "The order has not arrived yet or arrived late, and the wait is the complaint or question",
    "missing_or_wrong_item": "Something ordered is missing, a different item came, or the order never arrived although marked delivered",
    "food_quality": "The food arrived but is cold, spilled, spoiled, undercooked, contains something it should not, or tastes wrong",
    "payment_refund": "Charges, double charges, a refund already promised, payment methods, or a voucher that failed at checkout",
    "account_access": "Login, verification codes or OTP, a locked or hacked account, changing phone number or email",
    "none": ("None of these: compliments or feedback about a restaurant or rider with nothing to fix, partnership or job "
             "enquiries, deleting an account, dangerous rider behaviour alone, greetings or messages with no clear request"),
}

# Order matters: earlier answers are most stable, so the multi-problem check goes last.
QUESTIONS = {
    "queue": {
        "type": "choice",
        "instructions": "Which problem does the customer's `message` report?",
        "criteria": QUEUE_CRITERIA,
    },
    "safety": {
        "type": "noul",
        "instructions": "The `message` reports a health or safety problem.",
        "criteria": {
            "true": "An allergic reaction, feeling sick after eating, a foreign object such as hair, plastic or metal in the food, raw or spoiled food, or a rider behaving dangerously",
            "false": "Food that is only cold, spilled, late, missing or wrong, a payment or account issue, or no problem",
        },
    },
    "compensation": {
        "type": "noul",
        "instructions": "The customer asks for money back, credit or a voucher.",
        "criteria": {
            "true": "The customer asks for a refund, money back, credit or a voucher, or chases a refund already promised",
            "false": "The customer only reports a problem, asks a question or asks for something else, without asking for money, credit or a voucher",
        },
    },
    "multi": {
        "type": "noul",
        "instructions": ("The `message` reports problems of two or more of these kinds: a late order, a missing or wrong item, "
                         "poor food quality, a payment problem, an account access problem."),
        "criteria": {
            "true": "Two or more of those kinds, such as a late order and a missing item, or a double charge and a cold meal",
            "false": ("Only one of those kinds, even if described in several sentences, with several affected items, with a refund "
                      "request for it, or alongside complaints about rudeness or remarks about the rider or restaurant; or none of them"),
        },
    },
    "delete_account": {
        "type": "noul",
        "instructions": "The customer wants to delete or permanently close their Fastbite account.",
        "criteria": {
            "true": "The customer asks to delete, close or deactivate their account for good",
            "false": "The customer wants to keep using the account, or the message is about something else",
        },
    },
    "describes_event": {
        "type": "noul",
        "instructions": "The `message` describes something specific that happened or is happening.",
        "criteria": {
            "true": "The customer tells about a specific event, situation or problem",
            "false": "Only a greeting, a single word, punctuation, or a message too short to say anything specific",
        },
    },
}

MULTI_THRESHOLD = 0.5
# A weaker multi signal still sends the message to review when the queue choice itself is split.
MULTI_BAND = 0.3
QUEUE_SPLIT_GAP = 0.2
# Safety drifts to 0.5-0.6 on messages with no problem at all (greetings, login issues); real reports score >0.95.
SAFETY_THRESHOLD = 0.8
DELETE_ACCOUNT_THRESHOLD = 0.5
# Safety needs a message that actually describes something; near-empty messages drift high on safety.
DESCRIBES_EVENT_THRESHOLD = 0.5
COMPENSATION_THRESHOLD = 0.5

# valen_client.py: minimal HTTP client for Valen's System One endpoint.

BASE_URL = "https://api.valen-team.workers.dev/v1/systemone"
HEADERS = {"Content-Type": "application/json", "User-Agent": "fastbite-support-router/1.0"}


def ask(model, state, questions, timeout=25, retries=3):
    payload = {"model": model, "state": state, "questions": questions, "temperature": 1.0}
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(BASE_URL, data=data, headers=HEADERS, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = RuntimeError(f"Valen HTTP {e.code}: {e.read()[:300]!r}")
            if e.code not in (429, 500, 502, 503, 504):
                raise last
        except (urllib.error.URLError, TimeoutError) as e:
            last = RuntimeError(f"Valen request failed: {e}")
        time.sleep(2 * (attempt + 1))
    raise last

# solution.py: the decision logic.


def build_state(item):
    return {
        "context": CONTEXT,
        "order_status": item.get("order_status", "none"),
        "message": item.get("message", ""),
    }


def has_words(message):
    """True when the message contains any letter, digit or CJK character (not only punctuation)."""
    return any(ch.isalnum() for ch in message)


def decide(answers, message=""):
    queue = answers["queue"]["choice"]
    multi = answers["multi"]["noul"]
    safety = (answers["safety"]["noul"] >= SAFETY_THRESHOLD
              and answers["describes_event"]["noul"] >= DESCRIBES_EVENT_THRESHOLD
              and has_words(message))
    compensation = answers["compensation"]["noul"] >= COMPENSATION_THRESHOLD
    top, second = sorted(answers["queue"]["probabilities"].values(), reverse=True)[:2]
    split = multi >= MULTI_BAND and top - second < QUEUE_SPLIT_GAP
    deleting = answers["delete_account"]["noul"] >= DELETE_ACCOUNT_THRESHOLD
    if queue == "none" or multi >= MULTI_THRESHOLD or split or deleting:
        queue = "human_review"
    return {"queue": queue, "safety": bool(safety), "compensation": bool(compensation)}


def predict(item: dict) -> dict:
    body = ask(MODEL, build_state(item), QUESTIONS)
    return decide(body["answers"], item.get("message", ""))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--message", required=True)
    parser.add_argument("--order-status", default="none", choices=["delivered", "on_the_way", "cancelled", "none"])
    parser.add_argument("--replay", choices=["auto", "only", "off"], default="auto",
                        help="auto: reuse recorded answers and record new ones; only: recorded answers only; "
                             "off: always call the model")
    args = parser.parse_args(argv)
    item = {"message": args.message, "order_status": args.order_status}
    request = {"state": build_state(item), "questions": QUESTIONS}
    if args.replay == "off":
        body = ask(MODEL, request["state"], QUESTIONS)
    else:
        from common import recorded
        live = lambda: contextlib.nullcontext(lambda r: ask(MODEL, r["state"], r["questions"]))
        with recorded(live, args.replay, MODEL, BASE_URL) as predict:
            body = predict(request)
    print(json.dumps({"route": decide(body["answers"], args.message), "model_id": body.get("model_id"),
                      "question_set": QUESTION_SET_VERSION, "answers": body["answers"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
