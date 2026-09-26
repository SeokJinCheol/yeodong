# 여동 — 여행의 동선을 잇다

React + TypeScript / FastAPI / SQLite로 구현한 여행 동선 플래너 초안입니다.
Google API 키 없이 일정 관리와 지도·장소 검색을 사용할 수 있습니다. 경로 계산에는 Valhalla 서버가 필요합니다.

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

## Nginx에서 `/yeodong/`로 서비스하기

이 Mac의 Homebrew Nginx 설정은 `deploy/nginx/`에 보관합니다.
`yeodong.conf`는 80번 포트의 `/yeodong/`에서 빌드된 화면을 제공하고,
`/yeodong/api/` 요청을 `127.0.0.1:8001/api/`로 전달합니다.
`/yeodong`는 `/yeodong/`로 이동하며, `/rag/`는 아직 연결하지 않았습니다.

```sh
cd frontend
npm run build:nginx
```

백엔드는 앞의 실행 방법대로 8001번 포트에서 별도로 실행해야 합니다.
Nginx는 백엔드를 자동으로 시작하지 않습니다. 화면 수정 후에는 위 명령으로
다시 빌드합니다. 개발용 `npm run dev`는 기존 주소와 `/api` 경로를 그대로 사용합니다.

설정 설치 위치:

- 메인 설정: `/usr/local/etc/nginx/nginx.conf`
- 여동 설정: `/usr/local/etc/nginx/servers/yeodong.conf`
- 접근/오류 로그: `/usr/local/var/log/nginx/user-access.log`, `user-error.log`

메인 설정을 적용할 때는 기존 설정을 먼저 백업해야 합니다.
`deploy/nginx/nginx.conf`는 이 Mac의 경로를 사용하므로 다른 서버에서는
설정과 정적 파일의 절대 경로를 수정하세요.

```sh
nginx -t -e stderr
brew services restart nginx
curl -f http://localhost/yeodong/api/health
```

접속 주소는 `http://localhost/yeodong/`입니다. 도메인을 연결할 때는 DNS와
`server_name`을 설정하고 HTTPS 인증서를 적용해야 합니다.
현재 설정에는 도메인, HTTPS, 인증 기능이 포함되어 있지 않습니다.

## 구현 범위

- 날짜 선택, 장소 검색/직접 좌표 등록, 체류시간 입력
- 목록에서 장소 이름·주소·좌표·지역·날짜·체류시간 수정, 장소 삭제
- 장소별 필수 도착 시각, 대기시간 및 일정 충돌 표시
- 날짜별 출발지·도착지 선택 (전체 저장 장소에서 선택 가능)
- 도보·차량·대중교통 전환, 장소 변경 후 자동 동선 재계산
- 각 구간 시간/거리, 하루 총 이동시간·거리, 이동과 체류 합계
- 날짜 미정 장소의 근접 군집 추천, 코스를 선택한 날짜에 배정
- OpenStreetMap 지도, Valhalla 경로선과 순번 마커
- 브라우저 화면 크기에 맞춘 반응형 레이아웃

출발/도착지는 브라우저 localStorage에 날짜별로 보관합니다. 장소와 방문 날짜는 SQLite에 저장합니다.
한 장소에는 방문 날짜 하나를 지정합니다. 반복 방문은 별도 등록하세요.
출발지와 도착지가 같으면 왕복 코스를 계산합니다. 출발·도착지 체류시간은 합계에서 제외합니다.

## Valhalla 경로 계산과 Google 지도 내보내기

`backend/.env`에 여행 지역의 OSM 지도 타일을 갖춘 Valhalla 서버 주소를 설정한 뒤 백엔드를 재시작합니다.

```dotenv
VALHALLA_URL=http://localhost:8002
```

로컬 Docker 실행 구성은 `deploy/valhalla/compose.yaml`에 있습니다. 지도 준비와 시작·중지 명령은 [Valhalla 실행 안내](deploy/valhalla/README.md)를 참고하세요.
위 주소는 로컬 기본값이며 공개 서버로 자동 전송하지 않습니다.
배포 환경에서는 백엔드에서 접근할 수 있는 Valhalla 주소를 지정하세요.
`GET /status`, `POST /sources_to_targets`, `POST /route`가 제공되는 서버를 사용합니다.

1. 도보는 `pedestrian`, 차량은 `auto`로 이동시간 행렬을 조회합니다.
2. 기존 필수 순서·필수 도착 시각·체류시간 조건을 반영해 방문 순서를 정합니다.
3. Valhalla `/route`로 확정 순서의 구간 시간·거리·GeoJSON 경로를 조회합니다.
4. **Google 지도에서 동선 열기**로 출발지·경유지·도착지의 좌표와 순서를 전달합니다.

Google Routes API를 호출하지 않으며, 실패 시 직선 추정치로 대체하지 않습니다.
Google Maps URL에는 API 키가 필요하지 않습니다. 모바일 경유지 제한에 맞춰 중간 경유지를 최대 3개씩 나누고,
다음 링크는 이전 링크의 도착지에서 시작합니다. Google 지도는 전달된 순서를 기준으로 경로를 다시 계산하므로
Valhalla의 도로 경로·시간과 다를 수 있습니다. 출발 시각과 예약 조건은 URL로 전달되지 않습니다.

앱 내 지도는 **Leaflet + OpenStreetMap**으로 표시합니다. Google SDK와 Places API는 사용하지 않습니다.
Google 지도는 완성된 동선을 여는 외부 URL로만 연결합니다.
배경 타일은 현재 화면 영역만 브라우저에서 요청하며, 지도에 OSM 출처를 표시합니다.
지도 크기는 날짜·구간·화면 너비 변경 시 자동 갱신합니다. 배경 타일 오류 시 재시도 안내를 표시하고 방문지와 경로선은 유지합니다.

장소 검색은 OSM 기반 **Photon**을 사용합니다. 검색 버튼으로만 요청하며, 서버에서 요청 간격 1초와 24시간 캐시를 적용합니다.
기본 공개 데모 서버는 소규모 개인 사용을 위한 설정입니다. 사용량이 늘면 `PHOTON_URL`을 자체 서버로 변경하세요.
일부 장소는 현지어 또는 영문 검색이 필요합니다. 지도를 클릭해 좌표로 등록할 수도 있습니다.

| 설정 | 위치 | 기본값 |
|---|---|---|
| `PHOTON_URL` | `backend/.env` | `https://photon.komoot.io` |
| `VITE_MAP_TILE_URL` | `frontend/.env.local` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |

새 타일 공급자를 사용하는 경우 해당 공급자의 출처 표기도 함께 반영하세요.
[OpenStreetMap 타일 정책](https://operations.osmfoundation.org/policies/tiles/)에 따라 브라우저 캐시를 유지하고 대량·오프라인 다운로드는 제공하지 않습니다.
[Photon 공개 서버 안내](https://github.com/komoot/photon#demo-server)에 따라 제한된 요청량을 유지해야 합니다.

공식 문서: [Valhalla Matrix](https://valhalla.github.io/valhalla/api/matrix/),
[Valhalla Route](https://valhalla.github.io/valhalla/api/route/api-reference/),
[Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

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

### 서버 연결과 미리보기

Valhalla 연결 실패 시 오류를 표시하고 등록된 장소를 보존합니다.
Map 모드는 경로 API를 호출하지 않고 방문 순서만 보여줍니다.
Map 모드에서도 실제 OSM 배경 지도는 표시하며, 점선은 방문 순서만 나타냅니다.

### 다음 확장

- 여행 프로젝트/사용자별 데이터 분리, 인증
- 영업시간·휴무일·예약 시간 범위 반영
- 숙박 포함 다일 추천, 대중교통 시간 변화까지 고려한 방문 순서 탐색
- 장소별 복수 방문, 날짜별 출발/도착 설정의 서버 저장
- 장소 검색 입력 자동완성, API 사용량 제한 및 요청 취소

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
    geocoding.py  Photon 장소 검색 어댑터
    valhalla.py   Valhalla 행렬·경로 어댑터
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
Valhalla 및 Photon 어댑터 테스트는 모의 응답을 사용합니다. 실제 Valhalla 서버의 지도 데이터로 통합 확인이 필요합니다.
Google 지도 URL 순서·분할 검증: `cd frontend && node --test tests/mapsUrl.test.mjs` (Node 22.18 이상).


## 대중교통

현재 Valhalla 행렬 기반 최적화는 도보·차량을 지원합니다.
`TRANSIT` 요청은 422와 `X-Route-Unavailable: true`를 반환하며 Google API로 우회하지 않습니다.
대중교통 선택 시 필수 순서를 반영한 방문 목록에 대해 구간별 Google 지도 URL을 제공합니다.
이 목록은 최적화된 경로가 아니며, 날짜·출발 시각은 Google 지도에서 설정해야 합니다.

## 장소 수정과 필수 시각

동선 목록의 연필 버튼 또는 전체 장소 목록의 `수정`에서 체류시간과 장소 정보를 변경합니다.
`필수 도착 시각`에 12:00을 입력하면 방문 날짜의 여행지 현지 시각을 기준으로 계산합니다.
날짜 미정 장소의 시각은 날짜를 배정한 뒤 적용됩니다. 여행 출발 시각은 동선 설정에서 변경합니다.

일찍 도착하면 지정 시각까지 기다린 뒤 체류시간이 시작됩니다. 하루 합계는 이동·대기·중간 장소 체류시간을 포함합니다.
시각 조건이 있으면 최대 8개 중간 방문지의 순서를 탐색해 조건을 만족하면서 종료 시각이 가장 빠른 경로를 선택합니다.
지킬 수 없는 시각은 장소별 지각 시간과 함께 표시하며, 그 경로는 조건 미충족 경로입니다.
Valhalla 최종 경로 소요시간으로 시각을 다시 검증하므로 행렬 기반 탐색과 결과가 다를 수 있습니다.

### 일정 날짜 변경과 출발 안내

선택한 동선 구간은 **선택한 구간 복사**에서 다른 날짜 또는 같은 날짜로 복사할 수 있습니다. 장소·메모·체크리스트(완료 상태 포함)·체류시간·필수 순서·필수 시각을 유지하며 원본은 변경하지 않습니다. 출발·도착지와 시간대·출발 시각도 복사합니다. 대상 날짜가 비어 있으면 기본 구간으로, 장소·구간·구간 이름이 이미 있으면 **복사된 일정**이라는 새 구간으로 추가합니다. 같은 이름이 있으면 숫자를 붙여 구분합니다. 복사 후 전체 장소 수가 100개를 넘으면 저장하지 않습니다.

API는 `POST /api/itineraries/copy`이며 `source_date`, `target_date`, `section_id`와 선택적인 `start_id`, `end_id`를 받습니다. 새 구간과 원본→복사본 장소 ID 대응을 반환합니다. 모바일에서는 **일정 설정**을 펼쳐 복사 기능을 사용할 수 있습니다.

일정 상단의 `일정 날짜 변경`에서 하루 장소들을 빈 날짜로 함께 옮깁니다. 필수 시각과 체류시간, 선택한 출발·도착지는 유지됩니다. 이미 장소가 있는 날짜는 병합하지 않고 안내합니다.
필수 도착 장소 바로 앞에는 구간 소요시간을 역산한 `몇 시까지 출발` 안내가 표시됩니다. 자정을 넘으면 날짜도 표시하며, 현재 출발 계획이 늦으면 경고합니다. 대중교통은 시간에 따라 운행이 바뀌므로 역산값을 참고 시각으로 표시하며 해당 시각 재조회가 필요합니다.

### 필수 방문 순서

장소 수정의 `필수 방문 순서`는 중간 방문지의 실제 STEP 번호를 고정합니다. 3이면 STEP 03에 배치하며, 미지정 장소는 남은 자리를 최적화합니다. 출발·도착지는 별도이며 STEP에 포함하지 않습니다. 중복 번호나 중간 방문지 개수를 초과하는 번호는 오류로 안내합니다. 필수 시각과 충돌해도 STEP을 유지하고 지각을 표시합니다. 빈칸으로 저장하면 제한을 해제합니다.

### 장소 설명과 할 일

장소 추가·수정에서 장소 설명과 최대 50개의 할 일을 등록합니다. 할 일마다 상세 설명과 완료 상태를 저장할 수 있습니다. 동선 목록과 저장한 장소 관리에서 완료 체크를 바로 변경하며 완료 개수를 표시합니다. 체크 상태만 변경할 때는 경로를 재조회하지 않습니다. 설명과 체크리스트는 SQLite에 저장되고 기존 DB에는 필드를 자동 추가합니다.

### 저장된 동선 재사용

계산된 동선은 SQLite saved_plans에 저장하며 24시간 동안 같은 요청 조건의 결과를 재사용합니다. 날짜·출발/도착·이동수단·계산에 적용한 시간 설정·장소 좌표·체류시간·필수 순서/시각이 캐시 키에 포함됩니다. 설명과 체크리스트는 최신 장소 정보로 합쳐 표시합니다. 재계산 버튼은 force_refresh=true로 캐시를 갱신합니다. 만료 데이터는 다음 동선 요청 시 삭제합니다. UI에 저장 시각을 표시하며 지도 표시 요청 자체는 경로 캐시와 별개입니다.


### 날짜별 동선 구간

날짜 아래의 `구간 추가`로 오전·오후·저녁 등 이름을 정한 탭을 만들 수 있습니다. 기존 장소는 `기본 동선`에 유지됩니다. 구간마다 방문 장소, 출발·도착지, 출발 시각과 시간대를 따로 설정하며 경로도 해당 구간만 계산합니다. 장소 추가는 현재 구간에 저장되고, 장소 수정의 `동선 구간`에서 같은 날짜의 다른 구간으로 옮길 수 있습니다. 장소의 방문 날짜를 개별 변경하면 새 날짜의 기본 동선으로 이동합니다. `일정 날짜 변경`은 하루의 모든 구간과 장소를 함께 옮깁니다.

구간과 장소 배정은 SQLite에 저장됩니다. 백엔드 재시작 시 기존 DB에 sections 테이블과 places.section_id를 자동 추가합니다. 출발·도착지는 브라우저에 저장하며, 구간별 시간 설정은 현재 화면을 사용하는 동안 유지됩니다.
