# Battleships Board Visual Refresh Design

**Date:** 2026-04-17

**Goal:** Odświeżyć oprawę planszy statków 5x5 i modeli statków tak, aby ekran wyglądał wyraźnie lepiej, ale nadal pasował do obecnego ciemnego, schludnego, mobilnego stylu aplikacji.

## Context

Aktualny ekran gry statki renderuje planszę jako prostą siatkę 5x5 z kaflami CSS i ikoną `directions_boat` dla pól statków. Mechanika gry jest już poprawnie odseparowana od prezentacji:

- kliknięcia działają przez indeks komórki,
- plansza opiera się na stanach `empty`, `ship`, `hit`, `miss`, `available`, `blocked`,
- sekcja planszy renderowana jest przez `BoardSection`,
- pojedyncze pole renderowane jest przez `BoardCell`.

To oznacza, że można wykonać pełny lifting wizualny bez zmiany logiki rozgrywki, API ani modelu danych.

## Approved Direction

Wybrany kierunek to `Soft naval UI`.

To oznacza:

- brak fotorealizmu,
- brak kreskówkowego stylu,
- brak agresywnego futurystycznego UI,
- zachowanie obecnego charakteru aplikacji: ciemne tło, gładkie powierzchnie, subtelny glow, czytelne kontrasty, premium-mobile look,
- dodanie bardziej ilustracyjnej i dopracowanej planszy morskiej oraz 2.5D modeli statków.

## Visual Design

### Board Container

Plansza ma wyglądać jak elegancki panel morski osadzony w obecnym interfejsie.

Wymagania:

- zachować obecny rozmiar i proporcje planszy 5x5,
- zachować tytuły sekcji `Twoja plansza` i planszy przeciwnika,
- wprowadzić głębszy granatowo-stalowy gradient tła planszy,
- dodać subtelne wewnętrzne obramowanie i miękką poświatę,
- dodać delikatny wzór powierzchni przypominający wodę lub mapę morską, ale bardzo subtelny,
- zachować czytelność planszy na telefonie.

Plansza nie może wyglądać jak osobny motyw. Ma być naturalnym rozwinięciem obecnych tokenów kolorystycznych.

### Grid Cells

Każde pole planszy ma pozostać oddzielnym klikalnym przyciskiem, ale wizualnie ma zostać zmienione z prostego prostokąta na bardziej dopracowany morski kafel.

Wymagania:

- zaokrąglone pola pozostają, ale z lepszą głębią,
- pola `empty` mają wyglądać jak ciemna, spokojna tafla wody,
- pola aktywne do kliknięcia mają dostać delikatnie jaśniejszy stan oraz bardziej czytelny hover/focus,
- aktywny feedback przy kliknięciu ma zachować obecną responsywność,
- pola nie mogą wyglądać zbyt jasno ani odrywać uwagi od całości.

### Ship Visuals

Należy przygotować trzy spójne wizualnie modele statków:

- jeden statek długości 3,
- dwa statki długości 2.

Wymagania:

- assety mają być przygotowane jako osobne obrazy lub segmenty możliwe do osadzenia w UI,
- stylistyka: schludne, lekko ilustracyjne, z delikatnym rzutem 3/4 lub miękką pseudo-izometrią,
- kolorystyka: stal, grafit, chłodne refleksy, bez przesadnej tekstury,
- statki mają wyglądać sensownie i estetycznie, ale nie realistycznie w sposób ciężki lub filmowy,
- assety muszą dobrze działać zarówno na planszy gracza, jak i w panelu wyboru statków,
- statki poziome i pionowe muszą wyglądać poprawnie po obrocie.

Modele mają być spójne między sobą i rozpoznawalne jako jedna mini-flota.

### State Presentation

Różne stany planszy muszą pozostać jednoznaczne:

- `ship`: widoczny model statku osadzony w polu,
- `hit`: wyraźny stan trafienia, najlepiej z czerwono-pomarańczowym markerem uszkodzenia i lekkim kontrastem,
- `miss`: chłodny znacznik na wodzie, czytelny, ale mniej agresywny niż `hit`,
- `available`: subtelnie podbite pole do strzału lub ustawienia,
- `blocked`: stłumiony stan niedostępny.

Najważniejsze jest utrzymanie czytelności gry. Estetyka nie może osłabić rozpoznawania stanu pola.

### Ship Selection Panel

Panel wyboru trzech statków w sekcji `Ustawienie statków` ma zostać wizualnie zsynchronizowany z planszą.

Wymagania:

- każda karta statku powinna pokazywać miniaturę odpowiadającego modelu,
- stan wybranego statku ma być czytelny, ale zgodny z aktualnym wyglądem ekranu,
- stan ustawionego statku ma pozostać odróżnialny,
- panel nie ma zostać przebudowany funkcjonalnie, tylko wizualnie dopracowany.

## Interaction Rules

Zmiana dotyczy wyłącznie warstwy prezentacji i układu wizualnego.

Nie zmieniamy:

- mechaniki ustawiania statków,
- walidacji rozmieszczenia,
- logiki strzałów,
- stanu synchronizacji,
- API endpointów,
- formatu danych planszy.

Interakcje mają działać dokładnie jak obecnie:

- kliknięcie pola podczas setupu ustawia lub usuwa statek,
- kliknięcie pola podczas gry wykonuje strzał,
- orientacja statku nadal przełącza się istniejącym przyciskiem,
- gotowość, restart i statusy nie zmieniają zachowania.

## Technical Design

### File Scope

Główne miejsce zmian:

- `src/components/battleships-screen.tsx`

Dodatkowe pliki:

- nowe assety planszy i statków w `public/`,
- ewentualny mały, wydzielony helper renderujący statek lub segmenty statku, jeśli poprawi czytelność komponentu.

### Rendering Strategy

Warstwa planszy pozostaje oparta na siatce 5x5 i buttonach.

Preferowana strategia:

- zachować strukturę `BoardSection` i `BoardCell`,
- rozbudować klasy i markup wewnątrz `BoardCell`,
- dodać warstwę dekoracyjną w planszy i w komórkach,
- osadzić assety statków w polach `ship` i w kartach wyboru floty,
- użyć transformacji CSS dla pionowego wariantu statków, jeśli pozwoli to uniknąć duplikacji assetów.

Nie należy przepisywać całego ekranu gry od zera.

### Asset Format

Assety powinny być lekkie i przewidywalne do osadzenia w Next.js.

Preferencja:

- SVG dla planszy i/lub statków, jeśli da się zachować estetykę oraz łatwo skalować elementy,
- PNG tylko wtedy, gdy efekt wizualny wymaga bardziej malarskiej powierzchni i SVG okaże się zbyt ograniczające.

Jeśli statek będzie zbudowany z segmentów:

- segment środkowy i segment końcowy muszą dać się składać dla długości 2 i 3,
- orientacja ma być obsłużona przez rotację lub osobny wariant.

Jeśli statek będzie jednym obrazem na długość:

- trzeba zapewnić osobny wariant dla długości 3 i długości 2,
- dwa statki długości 2 mogą współdzielić ten sam asset.

## Constraints

- wygląd musi pozostać spójny z obecnym stylem aplikacji,
- wynik ma być schludny, estetyczny i jakościowo lepszy od obecnego,
- plansza ma działać dobrze na mobile,
- kod nie może komplikować logiki gry,
- lifting ma być lokalny dla ekranu statków.

## Testing Requirements

Po wdrożeniu trzeba potwierdzić:

- plansza setupu nadal pozwala ustawić wszystkie trzy statki,
- usuwanie i ponowne ustawianie statków nadal działa,
- orientacja pozioma/pionowa nadal działa poprawnie,
- plansza przeciwnika nadal przyjmuje strzały tylko w odpowiednich stanach,
- stany `ship`, `hit`, `miss` są jednoznacznie widoczne,
- układ nie rozpada się na telefonie.

## Out of Scope

- zmiana zasad gry,
- zmiana liczby pól lub statków,
- animacje złożone typu eksplozje lub cząsteczki,
- pełny redesign reszty ekranu gry,
- nowe dźwięki,
- zmiany backendowe.
