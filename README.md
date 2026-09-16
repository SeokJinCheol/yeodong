# 여동 — 여행의 동선을 잇다

React + TypeScript / FastAPI / SQLite로 구현한 여행 동선 플래너 초안입니다.
Google 키가 없어도 도쿄 샘플 데이터로 전체 흐름을 확인할 수 있습니다.

## 실행

Python 3.11 이상, Node.js 20.19 이상이 필요합니다. 터미널 두 개에서 실행하세요.

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

```sh
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

- 웹: http://localhost:5173
- API 문서: http://127.0.0.1:8001/docs
- SQLite: `backend/travel.db` (첫 실행 시 생성)

## 구현 범위

- 날짜 선택, 장소 검색/직접 좌표 등록, 체류시간 입력
- 목록에서 장소 이름·주소·좌표·지역·날짜·체류시간 수정, 장소 삭제
- 장소별 필수 도착 시각, 대기시간 및 일정 충돌 표시
- 날짜별 출발지·도착지 선택 (전체 저장 장소에서 선택 가능)
- 도보·차량·대중교통 전환, 장소 변경 후 자동 동선 재계산
- 각 구간 시간/거리, 하루 총 이동시간·거리, 이동과 체류 합계
- 날짜 미정 장소의 근접 군집 추천, 코스를 선택한 날짜에 배정
- Google Maps 경로 선과 순번 마커
- 브라우저 화면 크기에 맞춘 반응형 레이아웃

출발/도착지는 브라우저 localStorage에 날짜별로 보관합니다. 장소와 방문 날짜는 SQLite에 저장합니다.
한 장소에는 방문 날짜 하나를 지정합니다. 반복 방문은 별도 등록하세요.
출발지와 도착지가 같으면 왕복 코스를 계산합니다. 출발·도착지 체류시간은 합계에서 제외합니다.

## Google Maps 설정

Google Cloud 프로젝트에서 결제 연결 및 아래 API를 활성화합니다.

| 키 | 설정 위치 | 사용 API | 권장 제한 |
|---|---|---|---|
| 서버 키 | `backend/.env`의 `GOOGLE_MAPS_API_KEY` | Routes API, Places API (New) | 서버 IP 및 API 제한 |
| 브라우저 키 | `frontend/.env.local`의 `VITE_GOOGLE_MAPS_API_KEY` | Maps JavaScript API | HTTP referrer 및 API 제한 |

브라우저 키는 클라이언트에 공개되는 키입니다. 서버 키를 `VITE_` 변수에 넣지 마세요.
키 변경 후 해당 개발 서버를 재시작합니다. 실제 Google 호출에는 사용량에 따른 비용이 발생합니다.
경로를 계산할 때 장소 수 N에 대해 N×N개 행렬 요소와 경로 조회 1회를 요청합니다.
장소 검색은 검색 버튼으로 실행하며, 경로 변경은 350ms 지연 후 계산합니다.

연동 흐름:

1. Places Text Search로 이름·좌표·Place ID 선택
2. Routes Compute Route Matrix로 장소 간 이동시간 조회
3. 서버에서 출발·도착 고정 최단 방문 순서 계산
4. Compute Routes로 해당 순서의 구간 거리·시간·GeoJSON 경로 조회
5. Maps JavaScript API에 마커와 Polyline 표시

공식 문서: [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Compute Route Matrix](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix), [Compute Routes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), [지도 로딩](https://developers.google.com/maps/documentation/javascript/load-maps-js-api).

## 알고리즘과 초안의 제한

### 날짜별 동선

Held–Karp 동적 계획법으로 **조회한 이동시간 행렬 기준** 최단 순서를 계산합니다.
출발·도착 외 중간 방문지는 최대 8개로 제한합니다. 계산 복잡도는 O(n² × 2ⁿ)입니다.
실제 도로 방향에 따라 다른 A→B, B→A 시간을 각각 사용합니다.
도보·차량은 영업시간, 실시간 교통, 출발시각에 따른 이동시간 변화를 반영하지 않습니다.
날짜는 장소 배정 기준이며, 해당 미래 날짜의 교통 예측을 의미하지 않습니다.

### 장소 군집

그룹 내 모든 장소 쌍이 2.5km 이내인 그룹에 가까운 장소부터 배정합니다.
한 그룹은 최대 8개 장소이며, 그룹 내 순서는 최근접 방문 방식입니다.
추천명은 등록한 지역을 사용합니다. 군집은 좌표로 정하며 지역명이 같다는 이유로 합치지 않습니다.
숙박 여부나 1박/2박 일정 분할은 아직 구현하지 않았습니다.

### 데모 모드

서버 키가 없으면 직선거리와 일정한 속도(도보 4.5km/h, 차량 25km/h)로 추정합니다.
브라우저 키가 없으면 지도 대신 좌표 기반 개념도를 표시합니다. 실제 도로·교통을 나타내지 않습니다.
화면에 추정치와 샘플 데이터를 표시하며, Google 요청 실패를 데모 값으로 조용히 대체하지 않습니다.

### 다음 확장

- 여행 프로젝트/사용자별 데이터 분리, 인증
- 영업시간·휴무일·예약 시간 범위 반영
- 숙박 포함 다일 추천, 대중교통 시간 변화까지 고려한 방문 순서 탐색
- 장소별 복수 방문, 날짜별 출발/도착 설정의 서버 저장
- 장소 검색 입력 자동완성, API 사용량 제한 및 요청 취소
- 운영 환경의 Google 데이터 보관 정책 검토 및 보관 기간 관리

현재는 로컬 단일 사용자용 초안입니다. 인증 없이 공용 서버에 노출하는 운영 구성은 포함하지 않습니다.

## 디렉터리

```text
frontend/src/
  components/
    atoms/        Button, Badge
    molecules/    ModeSwitch, StatCard
    organisms/    PlaceForm, RouteTimeline, RouteMap, CourseList
    templates/    PlannerLayout
  pages/          PlannerPage (데이터/상태 연결)
  lib/            API 클라이언트, 공통 타입
backend/
  app/
    main.py       HTTP API
    models.py     요청/응답 검증
    db.py         SQLite 접근
    routing.py    순서 최적화 및 군집
    google.py     Google API 어댑터
    config.py     환경 설정
  tests/          알고리즘 및 API 검증
```

## 검증

```sh
cd backend
.venv/bin/python -m pytest -q
```

```sh
cd frontend
npm run build
```

테스트는 임시 SQLite DB를 사용해 샘플 데이터나 사용자 데이터를 변경하지 않습니다.
검증 환경의 Python 의존성 버전은 `backend/requirements.lock.txt`에 기록했습니다.
Google 어댑터 테스트는 모의 응답을 사용하며 실제 키로 호출한 통합 테스트는 별도로 필요합니다.


## 대중교통

- `TRANSIT` 이동수단과 출발 시각(기본 09:00), 여행지 시간대(기본 Asia/Tokyo)를 선택합니다.
- API 요청에는 `departure_time`(HH:mm), `time_zone`(IANA 시간대)을 전달할 수 있습니다.
- 여행 출발 시각의 이동시간 행렬로 방문 순서를 정한 뒤, 방문 구간별로 경로를 조회합니다.
- 다음 구간은 앞 구간의 소요시간과 중간 장소 체류시간을 더한 시각으로 조회합니다.
- 버스·철도 노선, 승하차역, 승하차 시각, 방향, 정류장 수, 환승 횟수, 도보 구간을 표시합니다.
- 총 이동시간은 Google 응답의 구간 시간을 합산합니다. 도보·대기·환승이 포함되며 체류시간은 별도 합산합니다.
- 시각별 운행 변화 때문에 전체 일정의 전역 최단 순서는 보장하지 않습니다.
- Google 키가 없거나 경로가 없는 경우 오류를 표시합니다. 대중교통 시간/노선을 임의로 추정하지 않습니다.
- 조회 가능 시각은 현재 기준 과거 7일~미래 100일입니다. 지역별 운행 데이터 지원 범위에 따라 조회가 불가능할 수 있습니다.
- 기존 Routes API 키를 사용하며 별도 API 활성화는 필요하지 않습니다. 매 계산마다 N×N 행렬 요소와 N−1회 구간 경로 조회를 요청합니다.

[Google 대중교통 경로 공식 문서](https://developers.google.com/maps/documentation/routes/transit-route)

### 일본 대중교통 제한

Google Routes API는 일본 교통 사업자의 대중교통 경로를 지원하지 않습니다.
현재 도쿄 일정에서는 대중교통 자동 최적화·소요시간·노선 표시를 제공할 수 없습니다.
조회 실패 시 등록 순서로 구간별 Google 지도 대중교통 링크를 제공합니다.
이 링크에는 날짜/출발시각을 전달하지 않으므로 Google 지도에서 다시 설정해야 합니다.
일본 내 앱 통합 경로 계산에는 별도 일본 교통 API의 계약 및 연동이 필요합니다.
근거: https://developers.google.com/maps/faq#transit_directions_countries

## 장소 수정과 필수 시각

동선 목록의 연필 버튼 또는 전체 장소 목록의 `수정`에서 체류시간과 장소 정보를 변경합니다.
`필수 도착 시각`에 12:00을 입력하면 방문 날짜의 여행지 현지 시각을 기준으로 계산합니다.
날짜 미정 장소의 시각은 날짜를 배정한 뒤 적용됩니다. 여행 출발 시각은 동선 설정에서 변경합니다.

일찍 도착하면 지정 시각까지 기다린 뒤 체류시간이 시작됩니다. 하루 합계는 이동·대기·중간 장소 체류시간을 포함합니다.
시각 조건이 있으면 최대 8개 중간 방문지의 순서를 탐색해 조건을 만족하면서 종료 시각이 가장 빠른 경로를 선택합니다.
지킬 수 없는 시각은 장소별 지각 시간과 함께 표시하며, 그 경로는 조건 미충족 경로입니다.
Google 최종 경로 소요시간으로 시각을 다시 검증하므로 행렬 기반 탐색과 결과가 다를 수 있습니다.
대중교통의 다음 구간 조회에도 필수 시각까지의 대기와 체류시간을 반영합니다.

### 일정 날짜 변경과 출발 안내

일정 상단의 `일정 날짜 변경`에서 하루 장소들을 빈 날짜로 함께 옮깁니다. 필수 시각과 체류시간, 선택한 출발·도착지는 유지됩니다. 이미 장소가 있는 날짜는 병합하지 않고 안내합니다.
필수 도착 장소 바로 앞에는 구간 소요시간을 역산한 `몇 시까지 출발` 안내가 표시됩니다. 자정을 넘으면 날짜도 표시하며, 현재 출발 계획이 늦으면 경고합니다. 대중교통은 시간에 따라 운행이 바뀌므로 역산값을 참고 시각으로 표시하며 해당 시각 재조회가 필요합니다.

### 필수 방문 순서

장소 수정의 `필수 방문 순서`는 중간 방문지의 실제 STEP 번호를 고정합니다. 3이면 STEP 03에 배치하며, 미지정 장소는 남은 자리를 최적화합니다. 출발·도착지는 별도이며 STEP에 포함하지 않습니다. 중복 번호나 중간 방문지 개수를 초과하는 번호는 오류로 안내합니다. 필수 시각과 충돌해도 STEP을 유지하고 지각을 표시합니다. 빈칸으로 저장하면 제한을 해제합니다.

### 장소 설명과 할 일

장소 추가·수정에서 장소 설명과 최대 50개의 할 일을 등록합니다. 할 일마다 상세 설명과 완료 상태를 저장할 수 있습니다. 동선 목록과 저장한 장소 관리에서 완료 체크를 바로 변경하며 완료 개수를 표시합니다. 체크 상태만 변경할 때는 경로를 재조회하지 않습니다. 설명과 체크리스트는 SQLite에 저장되고 기존 DB에는 필드를 자동 추가합니다.

### 저장된 동선 재사용

계산된 동선은 SQLite saved_plans에 저장하며 24시간 동안 같은 요청 조건의 결과를 재사용합니다. 날짜·출발/도착·이동수단·계산에 적용한 시간 설정·장소 좌표·체류시간·필수 순서/시각이 캐시 키에 포함됩니다. 설명과 체크리스트는 최신 장소 정보로 합쳐 표시합니다. 재계산 버튼은 force_refresh=true로 캐시를 갱신합니다. 만료 데이터는 다음 동선 요청 시 삭제합니다. UI에 저장 시각을 표시하며 지도 표시 요청 자체는 경로 캐시와 별개입니다.
