"""Score listing photos once per dimension, then let code weigh the dimensions for each storefront. Apache-2.0."""
import json

from common import HERE, client, emit, image_bytes, image_input, parser, request

DIMENSIONS = {
    "lighting": ("How well lit is the mug?", [
        ("poor", "Dark, heavily shadowed or color-cast; the glaze is hard to see"),
        ("fair", "Ordinary indoor light; the glaze is visible but flat"),
        ("good", "Bright, even light that shows the glaze clearly")]),
    "background": ("How clean is the background behind the mug?", [
        ("cluttered", "Other household objects compete with the mug"),
        ("plain", "A table or cloth with nothing else in view"),
        ("studio", "A seamless studio backdrop")]),
    "framing": ("How much of the mug is in the frame?", [
        ("cut_off", "Part of the mug, such as the handle, is outside the frame"),
        ("loose", "The whole mug is visible but small or off-center"),
        ("centered", "The whole mug is centered and fills the frame")]),
}
# Weights are business choices in code; changing them never needs another model call.
PROFILES = {"marketplace": {"lighting": 0.3, "background": 0.2, "framing": 0.5},
            "premium_shop": {"lighting": 0.3, "background": 0.5, "framing": 0.2}}


def score(predict, photo):
    questions = [{"name": name, "type": "score", "instructions": text,
                  "levels": [{"label": label, "description": description} for label, description in levels]}
                 for name, (text, levels) in DIMENSIONS.items()]
    answers = request(predict, image_input(image_bytes(HERE / "media" / photo)), questions)
    # Scores run 0-2 over three levels; divide by 2 so every dimension is on 0-1.
    return {"photo": photo, **{name: answers[name]["score"] / 2 for name in DIMENSIONS}}


def rank(scores, weights):
    total = lambda s: round(sum(weights[name] * s[name] for name in DIMENSIONS), 3)
    return sorted(({"photo": s["photo"], "score": total(s)} for s in scores), key=lambda x: x["score"], reverse=True)


def main():
    args = parser(__doc__).parse_args()
    photos = json.loads((HERE / "composite_scoring_data.json").read_text())
    with client(args) as predict:
        scores = [score(predict, photo) for photo in photos]
    emit({"dimensions": scores, "rankings": {name: rank(scores, w) for name, w in PROFILES.items()}}, args)


if __name__ == "__main__":
    main()
