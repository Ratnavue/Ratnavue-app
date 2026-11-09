-- Speciality tags on a gemstone (colour change, star, cat's eye, bi-colour),
-- shown on its card and product page. Additive: every existing stone gets an
-- empty list, so nothing changes until an admin tags one.

CREATE TYPE "GemSpecialty" AS ENUM ('COLOR_CHANGE', 'STAR', 'CATS_EYE', 'BI_COLOR');

ALTER TABLE "Gemstone" ADD COLUMN "specialties" "GemSpecialty"[] NOT NULL DEFAULT ARRAY[]::"GemSpecialty"[];
