# Ile winien?

Strona do dzielenia paragonu między trzy osoby.

1. Wpisz imiona trzech osób i wybierz, kto zapłacił.
2. Zrób zdjęcie paragonu (lub wybierz z galerii) – tekst odczytuje OCR (Tesseract.js, język polski) bezpośrednio w przeglądarce.
3. Popraw ewentualne błędy w nazwach/cenach, przy każdej pozycji zaznacz, do kogo należy (kilka osób = podział po równo).
4. Sekcja „Rozliczenie” pokazuje, ile każda osoba wydała i ile musi oddać osobie, która zapłaciła.

Strona jest w pełni statyczna (`index.html`, `style.css`, `parser.js`, `app.js`) – wystarczy ją otworzyć
lub opublikować np. przez GitHub Pages. Dane zapisywane są lokalnie w przeglądarce (localStorage).
Przy pierwszym skanie przeglądarka pobiera silnik OCR i słownik języka polskiego (~kilkanaście MB), więc potrzebny jest internet.
