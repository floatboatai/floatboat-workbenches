import { example } from "../src/contracts/example.ts";
import {
  fromDocument,
  jsonBytes,
  type Review,
} from "../src/contracts/document.ts";
/** Large but structurally valid metadata/notes, without giant rendered paragraphs. */
export function sizedReview(bytes: number, notes = 20): Review {
  const review = fromDocument(example);
  const original = review.original!;
  for (let index = 0; index < notes; index++) {
    const ref = `#/texts/${original.texts.length}`;
    original.texts.push({
      self_ref: ref,
      label: "text",
      text: `Appendix ${index + 1}`,
      orig: `Appendix ${index + 1}`,
      children: [],
      parent: { $ref: "#/body" },
      content_layer: "body",
      prov: [],
    });
    original.body.children.push({ $ref: ref });
    review.corrections[ref] = { note: "n".repeat(10000), reviewed: false };
  }
  original.padding = "";
  original.padding = "x".repeat(bytes - jsonBytes(review));
  return review;
}
