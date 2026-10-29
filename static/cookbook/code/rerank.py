"""Rerank retrieved help-center passages by whether each one answers the question. Apache-2.0."""
import json
import re

from common import HERE, client, emit, parser, request

STOP = {"a", "an", "the", "i", "my", "is", "can", "do", "to", "of", "in", "on", "for", "it", "if", "and", "or",
        "what", "how", "you", "your", "with", "be", "are", "at", "after", "from", "will", "does", "this"}


def words(text):
    return set(re.findall(r"[a-z]+", text.lower())) - STOP


def retrieve(query, passages, k):
    """A cheap keyword retriever stands in for BM25 or embeddings."""
    return sorted(passages, key=lambda p: len(words(query) & words(p["text"])), reverse=True)[:k]


def run(predict, query, passages, k=5):
    retrieved = retrieve(query["text"], passages, k)
    question = [{"name": "answers", "type": "predicate",
                 "instructions": "A support agent could answer the customer's question using only this passage."}]
    # Each passage gets its own request so no passage can sway the judgment of another.
    scored = [{"id": p["id"], "answers": request(predict, f"Customer question: {query['text']}\n\nHelp-center passage: "
                                                 f"{p['text']}", question)["answers"]["probability"]}
              for p in retrieved]
    reranked = sorted(scored, key=lambda x: x["answers"], reverse=True)
    best = reranked[0]
    return {"query": query["text"], "keyword_order": [p["id"] for p in retrieved],
            "reranked": reranked, "keyword_top_correct": retrieved[0]["id"] in query["relevant"],
            "reranked_top_correct": best["id"] in query["relevant"],
            "answer_with": best["id"] if best["answers"] >= 0.7 else None}


def main():
    args = parser(__doc__).parse_args()
    data = json.loads((HERE / "rerank_data.json").read_text())
    with client(args) as predict:
        results = [run(predict, query, data["passages"]) for query in data["queries"]]
    emit({"keyword_top1": sum(r["keyword_top_correct"] for r in results),
          "reranked_top1": sum(r["reranked_top_correct"] for r in results), "queries": results}, args)


if __name__ == "__main__":
    main()
