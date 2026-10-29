"""Check each claim in a draft against the source it cites; escalate what the source does not settle. Apache-2.0."""
import json

from common import HERE, client, emit, parser, request

QUESTIONS = [
    {"name": "supported", "type": "predicate", "instructions": "The source states what the claim says."},
    {"name": "contradicted", "type": "predicate", "instructions": "The source states something that conflicts with the claim."},
]


def run(predict, claim, sources):
    answers = request(predict, f"Claim: {claim['text']}\n\nSource [{claim['cites']}]: {sources[claim['cites']]}",
                      QUESTIONS)
    supported, contradicted = answers["supported"]["probability"], answers["contradicted"]["probability"]
    if contradicted >= 0.7:
        status = "contradicted"
    elif supported >= 0.7:
        status = "supported"
    elif supported < 0.3 and contradicted < 0.3:
        status = "unsupported"
    else:
        status = "escalate"
    return {"id": claim["id"], "cites": claim["cites"], "status": status,
            "supported": supported, "contradicted": contradicted}


def main():
    args = parser(__doc__).parse_args()
    data = json.loads((HERE / "citation_check_data.json").read_text())
    with client(args) as predict:
        checks = [run(predict, claim, data["sources"]) for claim in data["claims"]]
    emit({"publishable": all(c["status"] == "supported" for c in checks), "claims": checks}, args)


if __name__ == "__main__":
    main()
