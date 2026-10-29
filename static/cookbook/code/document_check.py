"""Check a scanned loan form against the record typed into the system, field by field. Apache-2.0."""
from datetime import date
import json

from common import HERE, client, emit, image_bytes, image_input, parser, request

FIELDS = {"name": "borrower name", "serial": "serial number", "return_date": "return date"}


def written(field, value):
    # The record is stored in machine form; ask about it the way a person would read it on paper.
    if field != "return_date":
        return value
    day = date.fromisoformat(value)
    return f"{day.day} {day:%B %Y}"


def run(predict, record):
    questions = [{"name": field, "type": "predicate",
                  "instructions": f"The {label} handwritten on the form is {written(field, record[field])}."}
                 for field, label in FIELDS.items()]
    questions.append({"name": "signed", "type": "predicate",
                      "instructions": "The signature box contains a handwritten signature."})
    answers = request(predict, image_input(image_bytes(HERE / "media" / record["scan"])), questions)
    checks = {name: answers[name]["probability"] for name in [*FIELDS, "signed"]}
    failed = [name for name, p in checks.items() if p < 0.3]
    unclear = [name for name, p in checks.items() if 0.3 <= p < 0.7]
    status = "reject" if failed else "review" if unclear else "accept"
    return {"scan": record["scan"], "status": status, "failed": failed, "unclear": unclear, "checks": checks}


def main():
    args = parser(__doc__).parse_args()
    records = json.loads((HERE / "document_check_data.json").read_text())
    with client(args) as predict:
        emit([run(predict, record) for record in records], args)


if __name__ == "__main__":
    main()
