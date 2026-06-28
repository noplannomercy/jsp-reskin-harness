# CLAUDE.md — 레거시 JSP 옷입히기 프로젝트

## 작업 시작 전

- 이 파일 → `WORKFLOW.md`(작업 시퀀스) → `INSTALL.md`(툴셋) 순으로 읽어라.
- **소스 도착 전**: `workflows/recon-request-template.md`로 정찰 준비만. 추측 코딩 금지.
- **소스 도착 후**: `WORKFLOW.md`의 `R → E → C → 페이지루프` 순서 그대로.

## 개요

공제업체(세종) 레거시 JSP에, 타 업체가 만든 정적 퍼블리싱(HTML+CSS)을 **동적 바인딩 보존한 채 입히는** 작업. 인사 화면 ≤15장, 2개월. 신규개발 아님.

## 제약 사항 (강제)

- `src/`는 **READ-ONLY 진실원천**. 작업 산출은 `work/`에만. (원본 보존 — 재딜리버리 대비)
- **뷰레이어만** 수정. 백엔드(컨트롤러/서비스/DAO/DB) 로직 수정 금지 — 오류는 리포트만.
- **로컬 완전체 구동** 안 되면 작업 금지. (상상코딩 E2E 차단)
- **master 직접 작업 금지.** feature 브랜치만.
- **자동 푸시 금지.** 출하는 사람 승인 후.

## 준수 사항

- **정찰(recon) 먼저** — 모든 후속의 입력. 정찰 없이 루프 돌리면 검증 기준도 없다.
- **grafting 계약**: 하드코딩·목업 금지 / 변수형태 유지 / charset 일치.
- **검증**: `/review`(정적) → `/qa`+`/browse`(동적, 데이터값 무시·반응형).
- 결과는 **WBS 미러 리포트**로 취합.

## 스택

- 레거시 **JSP + 구버전 Spring Boot + Oracle**. JSTL/커스텀태그. charset **EUC-KR 가능성**.
- 하네스: **context7 MCP** / **gstack**(`/qa`·`/browse`·`/review`) / **git**.
- 안 씀(이 작업엔 오버): graphify · grill · SQLcl · design-review · frontend-design · /ship · superpowers 풀코스(설계·TDD 불필요). 단 버그 안 잡힐 때 `systematic-debugging`만 escalation.

## 구조

| 경로 | 역할 |
|------|------|
| `INSTALL.md` | 툴셋 설치 간편가이드 |
| `WORKFLOW.md` | 작업 가이드(시퀀스·계약·검증·분기·리포트) |
| `workflows/recon-request-template.md` | ① 구조 정찰 자연어 템플릿(원본) |
| `workflows/recon-legacy-jsp.js` | ① 정찰 실행형(파생, 런타임 미검증) |
| `workflows/grafting-fanout-structure.md` | ② grafting 팬아웃 구조+I/O 배관 |
| `src/` | 레거시 원본 (READ-ONLY, 소스 도착 시) |
| `deliverables/` | 납품물 — `mapping.csv` + `pXX.html` (소스 도착 시) |
| `recon/` | 정찰 산출 `recon-report.json` |
| `work/` | 브랜치 작업트리 (grafting 결과) |
| `reports/` | `pages/*.json` · `screenshots/` · `wbs-report.md` |

## 하네스 진화 원칙

- 소스 보고 정찰 결과 나오면 이 문서·템플릿·구조 **갱신**(경로/매핑/chrome 구조 확정).
- 도구 추가는 **"안 넣으면 터지는 것"만**. 오버 금지 — 이 원칙은 설계 중 여러 번 깨지고 복원됨(graphify·SQLcl·/ship 등 다 뺀 이유).

## 완료 조건

- **페이지**: `/review` pass AND `/qa` pass(①렌더 ②레이아웃일치 ③실데이터 ④폼·콘솔) → clean → `work/` 커밋
- **배치**: `reports/wbs-report.md` 진척률 100% (전 페이지 완료/보류 처리 완)
