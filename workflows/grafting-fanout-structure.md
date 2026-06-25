# ② grafting 팬아웃 — dynamic workflow 구조

> 수동 루프(WORKFLOW.md)를 물량용으로 감싼 것. **수동이 기본 — 이건 물량 터질 때만.**
> recon(①)이 read-only 주력이라면, 이건 수정 보조. ≤15면 본전 애매하니 진짜 물량일 때.

---

## 전제 (안 되면 발사 금지)

- **Phase R 정찰 완료** → 정찰 리포트 손에: 보존필수 태그 / chrome 선처리 / charset 대응 / 페이지 리스크
- **Phase E 로컬 완전체 기동** → 앱 떠 있음 (Tier 2 `/qa`에 필수)
- **Phase C 공통 chrome 1회 완료** → 페이지들이 공유파일 안 건드리게

## 입력

- 대상 페이지 목록 (+ 업체 매핑: `JSP ← 납품HTML`)
- 납품 디자인 파일 경로
- 정찰 decisions (보존필수 태그, charset action)

---

## 구조 — 2단 (정적 병렬 / 동적 직렬)

```
[Tier 1] 정적 팬아웃 — 페이지마다 병렬
         (서로 다른 .jsp 파일 = 충돌 없음 → 워크트리 격리 불필요)

   1.5 바인딩 인벤토리   ★항상 원본 JSP에서★ (덧입히기 금지)
   3   grafting         납품 마크업 교체 + 바인딩 재주입
                        (계약: 하드코딩·목업 금지 / 변수형태 유지 / charset 일치)
   5   /review          1.5 인벤토리 기준 보존 검증
   → 페이지별 정적 레코드 (정적 pass/fail + diff)

        ↓ barrier (정적 결과 전부 모음)

[Tier 2] 동적 직렬 — 단일 앱에 한 장씩 (톰캣 하나라 병렬 불가)

   배포 → 6 /qa + /browse   렌더·레이아웃일치(데이터무시)·반응형·동적데이터 (①~④)
   → 페이지별 UI 레코드 (+ 스샷)

        ↓

[취합]   WBS 미러 리포트 생성 + triage (clean / flagged + 사유)

        ↓

[사람 게이트] ★워크플로우는 여기서 정지 — 자동 푸시 안 함★
   사람이 triage 보고 → clean 일괄 승인 → 커밋/푸시
   flagged → 안 막음, 사람 수정 → 그 페이지만 원본부터 재진입
```

---

## 데이터 배관 (I/O) — 경로는 소스 도착 시 확정, 계약은 지금 고정

아티팩트 레이아웃:
```
src/          레거시 원본. ★READ-ONLY 진실원천★ (절대 안 씀)
deliverables/ 납품물 — mapping.csv(JSP←HTML 페어) + pXX.html
recon/        recon-report.json (정찰 산출, 모든 후속의 입력)
work/         브랜치 작업트리 — grafting 결과는 여기
reports/      pages/*.json(레코드) · screenshots/ · wbs-report.md
```

stage별 읽기 → 쓰기:
```
R 정찰      src/ 전체 + deliverables/mapping       → recon/recon-report.json
C chrome    recon + deliverables + src/chrome      → work/(입힌 chrome)
1.5 인벤토리 src/<jsp> ★원본★ + recon(보존필수태그)  → reports/pages/<p>.json
3 grafting  src/<jsp> + deliverables/<html> + 인벤토리 + recon(charset) → work/<jsp>
5 /review   diff(work/<jsp> vs src/<jsp>) + 인벤토리 → reports/pages/<p>.json
6 /qa       실행앱 URL + deliverables/<html>(baseline) → reports/pages/<p>.json + screenshots/
취합        reports/pages/*.json                   → reports/wbs-report.md
게이트      wbs-report.md → clean 승인 → work/ 커밋·푸시
```

핵심: **읽기 = src/(원본), 쓰기 = work/. 절대 안 섞임.** 페어링 = `deliverables/mapping.csv`.

---

## 산출물

- **WBS 미러 리포트** (clean/flagged, 진척률) — 내부용
- 페이지별: 정적 레코드 + UI 레코드 + 스샷
- **grafted 작업트리** (푸시 전 — 사람 승인 대기)

---

## 기본 결정 (바꾸려면 말해)

1. **정적 병렬 / 동적 직렬 분리** — 워크트리 풀병렬 아님(≤15엔 과함). 단일앱 제약을 직렬로 흡수.
2. **사람 게이트 = 취합 후 일괄 승인** — clean 배치 한 번에. flagged 별도 트래킹.
3. **자동 푸시 없음** — 워크플로우는 triage까지, 푸시는 사람 승인 후.

---

## 이 구조 → 실행형(.js) 매핑 (나중)

- Tier 1 = `pipeline(pages, 인벤토리, grafting, review)` 또는 `parallel`
- barrier = Tier 1 전체 await
- Tier 2 = clean 페이지 **순차** `/qa` (단일앱 직렬)
- 취합 = 리포트 합성 agent
- 사람 게이트 = 워크플로우 return(푸시 전), 메인루프에서 사람 확인
