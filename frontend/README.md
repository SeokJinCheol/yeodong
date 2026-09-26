# 프런트엔드 구조

아토믹 디자인은 UI 구성에 적용합니다. API 호출·비동기 상태는 `hooks`, React와 무관한 일정 규칙은 `lib/planner.ts`에서 관리합니다.

| 계층 | 책임 |
| --- | --- |
| `components/atoms` | 버튼·배지 등 기본 UI |
| `components/molecules` | 이동수단 선택, 날짜 변경 폼, 장소·길찾기 링크 |
| `components/organisms` | 구간 관리, 경로 설정, 타임라인, 지도와 요약 등 기능 단위 UI |
| `components/templates` | 공통 화면 틀 |
| `pages/PlannerPage.tsx` | 훅과 UI 연결, 날짜·선택·모달 상태 및 화면 간 동작 조율 |

## 상태와 일정 규칙

- `usePlannerData`: 초기 데이터 조회, 장소 변경, 추천 코스 배정, 변경 후 새로고침과 오류 처리.
- `useRouteSections`: 날짜별 구간 선택과 추가·이름 변경·삭제.
- `useRouteSettings`: 구간별 출발·도착지와 시간 설정. 출발·도착지를 localStorage에 저장하고 날짜 이동·삭제 시 설정도 함께 정리.
- `useRoutePlan`: Valhalla 요청, 350ms 지연, 이전 요청 결과 무시, 이용 불가 상태와 강제 재계산.
- `lib/planner.ts`: 날짜 목록, 필수 STEP 배치, 저장 장소 정렬, 경로 입력 비교, 날짜별 설정 이동·삭제.

시간대·출발 시각은 변경 즉시 재계산하지 않습니다. `useRoutePlan`의 요청 의존성에 두 값을 추가하면 이 동작이 바뀝니다. 재계산 버튼은 최신 시간 설정을 사용합니다. 메모·체크리스트 수정도 경로 재계산을 유발하지 않으며, 표시 중인 장소 정보만 갱신합니다.

화면 컴포넌트에는 필요한 값과 동작 콜백을 전달합니다. API 호출이나 페이지 전체 상태를 새 UI 컴포넌트로 옮기지 않습니다.

## 검증

```sh
node --test tests/*.test.mjs
npm run build:nginx
```

Node.js 22.18 이상이 필요합니다. 순수 함수 테스트는 고정 STEP·왕복·다른 날짜 제외·날짜 이동·삭제 범위와 경로 재계산 입력을 검증합니다. 브라우저에서는 Map/도보 전환, 시간 변경 후 수동 재계산, 날짜 전환과 구간 폼, 지도와 STEP 링크를 확인합니다. `/yeodong/`에서 서비스할 때는 `build:nginx`를 사용합니다.

## 코드 포맷

```sh
npm run format
npm run format:check
```

`src`의 TypeScript·TSX·CSS를 정리합니다. 들여쓰기는 4칸, 중괄호 안쪽 공백은 1칸입니다. JSX 자식 태그와 여닫는 태그는 각각 줄을 나누며, 동적 표현식은 `{`와 `}` 사이에 별도 줄로 배치합니다. 짧은 단일 속성 태그는 한 줄, 여러 속성은 속성별 줄바꿈을 사용합니다.

기본 규칙은 `.prettierrc.json`, JSX 줄바꿈·공백 규칙은 `scripts/format.mjs`에서 관리합니다. JSX 텍스트의 유의미한 공백을 보존하기 위해 일부 문자열 표현식은 한 줄로 유지합니다. 포맷 과정에서 변환 전후 JavaScript 구문과 JSX 텍스트를 비교하고, 달라지면 해당 파일을 저장하지 않습니다. 일반 Prettier만 실행하면 JSX 전용 규칙이 유지되지 않으므로 위 명령을 사용하세요.
