"""Screen an LLM's draft reply against support policy before it reaches the customer. Apache-2.0."""
import json

from common import HERE, client, emit, parser, request

# One predicate per rule, never "A or B", so each probability says which rule a draft breaks.
RULES = {
    "promises_compensation": "The reply promises the customer a refund, credit or other compensation.",
    "asks_for_password": "The reply asks the customer for their password.",
    "asks_for_code": "The reply asks the customer to send a verification code they received.",
    "asks_for_card": "The reply asks the customer for their full card number.",
    "blames_customer": "The reply tells the customer the problem is their own fault.",
}
ANSWERS = "The reply addresses what the customer asked about."


def run(predict, case):
    questions = [{"name": name, "type": "predicate", "instructions": text} for name, text in RULES.items()]
    questions.append({"name": "answers_customer", "type": "predicate", "instructions": ANSWERS})
    answers = request(predict, f"Customer message: {case['customer']}\n\nDraft reply: {case['draft']}", questions)
    rules = {name: answers[name]["probability"] for name in RULES}
    answered = answers["answers_customer"]["probability"]
    broken = [name for name, p in rules.items() if p >= 0.7]
    unclear = [name for name, p in rules.items() if 0.3 <= p < 0.7]
    if broken:
        action = "block"
    elif unclear:
        action = "human_review"
    elif answered < 0.3:
        action = "regenerate"
    else:
        action = "send"
    return {"id": case["id"], "action": action, "broken": broken, "unclear": unclear,
            "rules": rules, "answers_customer": answered}


def main():
    args = parser(__doc__).parse_args()
    cases = json.loads((HERE / "llm_guardrails_data.json").read_text())
    with client(args) as predict:
        emit([run(predict, case) for case in cases], args)


if __name__ == "__main__":
    main()
