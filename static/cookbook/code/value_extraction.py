"""Select instead of generate: code finds the dates, Valen picks the one the business needs. Apache-2.0."""
from datetime import date
import json
import re

from common import HERE, choice_status, client, emit, parser, request

MONTHS = {m: i + 1 for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july",
                                         "august", "september", "october", "november", "december"])}
PATTERN = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2}) (" + "|".join(MONTHS) + r")\b|\b("
                     + "|".join(MONTHS) + r") (\d{1,2})\b", re.IGNORECASE)


def candidates(text, year):
    """Every date written in the message, normalized by code; the model never writes a date."""
    found = []
    for m in PATTERN.finditer(text):
        if m.group(1):
            value = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        else:
            day, month = (m.group(4), m.group(5)) if m.group(4) else (m.group(7), m.group(6))
            value = date(year, MONTHS[month.lower()], int(day))
        found.append({"span": m.group(0), "iso": value.isoformat(),
                      "context": text[max(0, m.start() - 60):m.end() + 40].replace("\n", " ")})
    return found


def run(predict, email):
    found = candidates(email["text"], email["year"])
    asked = [{"name": "has_new_date", "type": "predicate",
              "instructions": "The supplier gives a new delivery date in this email."}]
    if found:
        asked.append({"name": "delivery_date", "type": "choice",
                      "instructions": "Which date is the new date the order will be delivered?",
                      "choices": [{"value": c["span"], "description": f"The date in: “{c['context']}”"}
                                  for c in found]})
    answers = request(predict, email["text"], asked)
    has_new = answers["has_new_date"]["probability"]
    result = {"id": email["id"], "candidates": [c["span"] for c in found], "has_new_date": has_new}
    if has_new < 0.3 or not found:
        return {**result, "status": "no_new_date"}
    picked = answers["delivery_date"]
    confidence, certain = choice_status(picked)
    status = "update_order" if certain and has_new >= 0.7 else "review"
    iso = next(c["iso"] for c in found if c["span"] == picked["choice"])
    return {**result, "status": status, "delivery_date": iso, "span": picked["choice"], "confidence": confidence}


def main():
    args = parser(__doc__).parse_args()
    emails = json.loads((HERE / "value_extraction_data.json").read_text())
    with client(args) as predict:
        emit([run(predict, email) for email in emails], args)


if __name__ == "__main__":
    main()
