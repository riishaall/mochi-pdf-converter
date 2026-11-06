const imageNames = [
  "404",
  "cookie",
  "delete",
  "error",
  "locked",
  "offline",
  "sleeping",
  "stretching",
  "success",
  "toobig",
  "typing",
  "upload",
  "welcome",
  "wrongfile",
];

export const CAT_IMAGES = Object.freeze(
  Object.fromEntries(
    imageNames.map((name) => [
      name,
      Object.freeze({
        png: `/photos/${name}.png`,
        webp: `/photos/${name}.webp`,
        alt: {
          "404": "Mochi the cream kitten is looking for the missing page",
          cookie: "Mochi the cream kitten is holding a little treat",
          delete: "Mochi the cream kitten is asking before tidying files",
          error: "Mochi the cream kitten looks surprised by a little mistake",
          locked: "Mochi the cream kitten is looking at a locked document",
          offline: "Mochi the cream kitten is taking a cozy internet nap",
          sleeping: "Mochi the cream kitten is sleeping peacefully on a lavender cushion",
          stretching: "Mochi the cream kitten is stretching, ready for a PDF",
          success: "Mochi the cream kitten is celebrating with hearts",
          toobig: "Mochi the cream kitten is reacting to an extra-large file",
          typing: "Mochi the cream kitten is typing on a tiny laptop",
          upload: "Mochi the cream kitten has received a document",
          welcome: "Mochi the cream kitten is waving hello",
          wrongfile: "Mochi the cream kitten is puzzled by a non-PDF file",
        }[name],
      }),
    ]),
  ),
);

export const CAT_IMAGE_PRELOAD = CAT_IMAGES.sleeping.webp;

export const RATING_FACES = Object.freeze([
  { mood: "grumpy", label: "Not great" },
  { mood: "sad", label: "Could be better" },
  { mood: "neutral", label: "It was okay" },
  { mood: "happy", label: "Pretty good" },
  { mood: "delighted", label: "Purrfect" },
]);
