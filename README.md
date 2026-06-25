# jsp-reskin-harness

> 레거시 JSP에 **납품된 정적 퍼블리싱(HTML+CSS)을 입히는** 작업을, AI 보조로 굴리는 가벼운 하네스.
> 퍼블리싱은 외주, 우리는 받아서 JSP에 옷 입히기 — **동적 바인딩은 살린 채.**

신규개발도 대규모분석도 아니다. 기계적 grafting을 **정찰 → 입히기 → 검증 → 리포트**로 규율화한 것.

---

## 철학

- **수동이 기본, 자동(ultracode)은 escalation.** 물량 터질 때만 팬아웃.
- **얇게.** 일의 실체에 안 쓰이는 도구는 다 뺀다 (graphify·grill·SQLcl·design-review·/ship 등 제외).
- **원본 불가침.** `src/`는 읽기 전용 진실원천, 작업은 `work/`에만 — 재딜리버리 와도 원본에서 새로.
- **검증 안 한 건 안 넘긴다.** 로컬 완전체 구동이 하드게이트.

## 워크플로우 한눈에

```
작업 시작 시(1회):  R.구조 정찰 → E.로컬 완전체 기동 → C.공통 chrome 1회
페이지 루프(반복):  1.열기 → 1.5.바인딩 인벤토리 → 2.context7 → 3.grafting
                   → 4.빌드 → 5./review → 6./qa+/browse → 7.리포트 → 8.분기
```

**정찰(R)이 모든 후속의 입력** — 보존필수 태그·chrome 구조·charset·페이지 리스크를 한 번에 떠서, 이후 입히기/검증이 그걸 참조한다.

## 도구셋

| 슬롯 | 도구 |
|------|------|
| 레퍼런스 | context7 MCP (JSP/JSTL/EL 정확 문법) |
| diff 검토 | `/review` (바인딩 보존 검증) |
| UI 검증 | `/qa` + `/browse` (렌더·레이아웃일치·반응형) |
| 출하 | git 브랜치 커밋/푸시 |

## 구성

| 파일 | 내용 |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | 프로젝트 컨텍스트·제약·구조·완료조건 (세션 자동로드) |
| [`INSTALL.md`](INSTALL.md) | 툴셋 설치 간편가이드 |
| [`WORKFLOW.md`](WORKFLOW.md) | 작업 시퀀스·grafting 계약·검증 기준·분기·리포트 |
| [`workflows/recon-request-template.md`](workflows/recon-request-template.md) | ① 구조 정찰 자연어 템플릿(원본) |
| [`workflows/recon-legacy-jsp.js`](workflows/recon-legacy-jsp.js) | ① 정찰 실행형(dynamic workflow, 파생) |
| [`workflows/grafting-fanout-structure.md`](workflows/grafting-fanout-structure.md) | ② grafting 팬아웃 구조 + I/O 배관 |

## 쓰는 법

1. `INSTALL.md` 보고 툴셋 설치 (context7 + gstack).
2. 소스 도착 → `src/`·`deliverables/`(납품물 + `mapping.csv`) 채움.
3. `workflows/recon-request-template.md`에 경로 채워 **정찰 1회** → `recon/recon-report.json`.
4. `WORKFLOW.md`의 `R → E → C → 페이지루프` 그대로 진행.
5. 물량 크면 `grafting-fanout-structure.md`의 ② 팬아웃으로 escalation.

## 상태

🟡 **소스 도착 전 준비 단계.** 하네스·시퀀스·정찰 템플릿 확정. 경로/매핑/charset 등은 소스 보고 확정.

---

*가벼운 게 미덕. 도구는 "안 넣으면 터지는 것"만.*
