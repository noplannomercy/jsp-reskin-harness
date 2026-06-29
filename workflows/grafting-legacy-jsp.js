export const meta = {
  name: 'grafting-legacy-jsp',
  description: '레거시 JSP에 납품 정적 디자인(HTML+CSS)을 동적 바인딩 보존한 채 입히는 grafting 팬아웃(②). 공유 chrome 1회 선처리 → 페이지별 병렬(인벤토리+grafting → 독립 정적 review) → 동적 qa(앱 있으면, 단일앱 직렬) → WBS 취합 → 사람 게이트 정지. src/ READ-ONLY, 산출은 work/, 리포트는 reports/. recon decisions를 args로 받아 전 에이전트에 주입. 실행: Workflow({scriptPath, args:{sourcePath, reconDecisions, chrome, pages, appBootable?}}). 대상 >15페이지일 때 escalation — 이하면 수동 루프(WORKFLOW.md).',
  phases: [
    { title: 'Chrome', detail: '공유 header/footer 1회 재스킨' },
    { title: 'Graft', detail: '페이지별 병렬 인벤토리+grafting' },
    { title: 'Review', detail: '독립 스키eptic 정적 보존검증(+chrome 경계)' },
    { title: 'Synthesize', detail: 'WBS 미러 + triage 취합' },
  ],
}

// ── 입력 (args) ──────────────────────────────────────
// args.sourcePath     : 프로젝트 루트 (src/·deliverables/·recon/·work/·reports/ 의 부모). 필수.
// args.reconDecisions : 정찰 리포트 핵심 decisions 문자열 — 전 에이전트 컨텍스트에 주입(recon 그대로 넘김). 권장.
// args.reconReport    : recon-report.json 상대경로 (에이전트가 디테일 확인용으로 Read). 선택.
// args.chrome         : { files:[{jsp,out}], deliveredRef } 공유 chrome 선처리 대상. 선택(없으면 chrome 단계 스킵).
// args.pages          : [{ wbs, jsp, html, out, risk?, watchFor?, mockup? }] 페이지 매핑. 필수.
// args.appBootable    : 로컬 완전체 구동 가능 여부 (Tier2 동적 qa 게이트). 기본 false.
// args는 객체로 오는 게 정상이나, 런타임에 따라 JSON 문자열로 도착할 수 있어 둘 다 흡수.
const A = (() => {
  if (args == null) return {}
  if (typeof args === 'string') { try { return JSON.parse(args) } catch (e) { return {} } }
  return args
})()
const SRC = A.sourcePath || '.'
const RECON_PATH = A.reconReport || 'recon/recon-report.json'
const RECON_DECISIONS = A.reconDecisions || ''
const CHROME = A.chrome || null
const PAGES = A.pages || []
const APP_BOOTABLE = !!A.appBootable

// 가드: 입력 비면 조용히 헛돌지 말고 즉시 실패 (args 미바인딩/매핑 누락 조기탐지)
if (!PAGES.length) {
  throw new Error(`grafting-legacy-jsp: args.pages 비어있음 — 대상 페이지 매핑(JSP←납품HTML) 필요. args 전달 여부 확인. (resolved sourcePath=${SRC})`)
}

const RECON = RECON_DECISIONS
  ? `정찰 리포트 핵심 decisions — grafting의 진실원천. 추측 말고 이걸 따른다:\n\n${RECON_DECISIONS}`
  : `정찰 리포트(${SRC}/${RECON_PATH})를 먼저 Read해서 decisions(charsetAction/chromeFirst/보존필수태그/serverContract)를 근거로 삼아라. 추측 금지.`

const CONTRACT = `grafting 계약 (강제):
- src/ READ-ONLY 진실원천. 절대 편집/생성/삭제 금지. 읽기만.
- 산출은 work/ 에만 Write. 절대 src/ 에 쓰지 마라.
- 하드코딩·목업 금지: 납품 HTML 샘플데이터(이름/사번/날짜/부서)를 동적 바인딩(EL/JSTL/스크립틀릿/커스텀태그)으로 환원.
- 변수형태 유지: 기존 EL/JSTL, 폼 action·method·name, include 경로 보존.
- 커스텀태그(hca:* 등) 동적 — 정적 텍스트/버튼 치환 절대 금지. 위치·속성째 보존.
- ★chrome 경계 엄수: 공유 chrome(header/footer)이 페이지 골격 컨테이너(<main class="content"> / <div id="container"> 등)의 열기·닫기를 소유한다. 페이지 본문은 그 컨테이너 *내부 조각만* 출력하라 — 컨테이너 태그를 다시 열거나 본문을 <main>/래퍼로 재감싸지 마라(중첩되면 무효 HTML + 이중 래퍼). 페이지 산출물 최상위는 콘텐츠 요소(h1/form/table/dl 등)여야 하고, include(header) 직후 <main>으로 시작하면 안 된다.

${RECON}`

const CHROME_SCHEMA = { type: 'object', additionalProperties: false, required: ['preservedBindings', 'charsetFixed', 'outPaths', 'note'], properties: { preservedBindings: { type: 'array', items: { type: 'string' } }, charsetFixed: { type: 'string' }, outPaths: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } } }
const GRAFT_SCHEMA = { type: 'object', additionalProperties: false, required: ['page', 'outPath', 'inventory', 'mockupReverted', 'charsetFixed', 'note'], properties: { page: { type: 'string' }, outPath: { type: 'string' }, inventory: { type: 'array', items: { type: 'string' } }, mockupReverted: { type: 'array', items: { type: 'string' } }, charsetFixed: { type: 'string' }, note: { type: 'string' } } }
const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['page', 'result', 'bindingsMissing', 'mockupLeftover', 'charsetOk', 'chromeBoundaryOk', 'findings'], properties: { page: { type: 'string' }, result: { type: 'string', enum: ['pass', 'fail'] }, bindingsMissing: { type: 'array', items: { type: 'string' } }, mockupLeftover: { type: 'array', items: { type: 'string' } }, charsetOk: { type: 'boolean' }, chromeBoundaryOk: { type: 'boolean', description: '페이지 산출물이 chrome 소유 컨테이너(<main>/#container)를 중복으로 열지 않으면 true' }, findings: { type: 'string' } } }
const WBS_SCHEMA = { type: 'object', additionalProperties: false, required: ['wbsMarkdown', 'summary', 'triage'], properties: { wbsMarkdown: { type: 'string' }, summary: { type: 'string' }, triage: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['page', 'status'], properties: { page: { type: 'string' }, status: { type: 'string' } } } } } }

// ── Phase C: 공유 chrome 1회 (페이지 루프 전 선처리 — 충돌 차단) ──
phase('Chrome')
log(`grafting 시작 — ${SRC} / 대상 ${PAGES.length}페이지 / chrome ${CHROME ? '있음' : '없음'} / recon ${RECON_DECISIONS ? '인라인주입' : '경로참조'}`)

let chromeResult = null
if (CHROME) {
  const chromeFilesDesc = (CHROME.files || []).map(f => `  원본 ${SRC}/${f.jsp}  ->  산출 ${SRC}/${f.out}`).join('\n')
  chromeResult = await agent(`${CONTRACT}

[C단계] 공유 chrome 1회 재스킨 (header + footer). 페이지마다 건드리면 충돌 — 여기서 한 번만.
대상:
${chromeFilesDesc}
납품 디자인(chrome 골격 추출 참조): ${SRC}/${CHROME.deliveredRef}

순서:
1. 원본 chrome 파일 Read — 소유 마크업·보존 바인딩·컨테이너 경계(어디서 열고 footer 어디서 닫는지) 파악.
2. 납품 HTML에서 chrome 골격만 추출: 헤더(brand/nav/user-box) + 콘텐츠 컨테이너(<main class="content"> 등) 열기 / 닫기 + 푸터.
3. 레거시 컨테이너 열고닫기(header 끝 / footer 시작)를 납품 컨테이너 열기/닫기로 미러. ★컨테이너 열기는 header 산출물에, 닫기는 footer 산출물에 — 페이지가 아니라 chrome이 소유.
4. chrome 동적바인딩을 납품 정적텍스트(로그인명/링크) 자리에 환원. taglib 선언 보존.
5. charset: 정찰 charsetAction대로 선언 정정. legacy CSS -> 납품 디자인 CSS 절대경로 교체.
6. work/ out 경로에 각각 Write. src/ 절대 금지.
반환: 보존 바인딩/정정 charset/out 경로/note.`,
    { label: 'chrome', phase: 'Chrome', schema: CHROME_SCHEMA })
  log(`chrome: ${chromeResult ? chromeResult.charsetFixed : 'FAILED(null)'}`)
}

// ── Tier1: 페이지별 정적 팬아웃 (graft -> 독립 review). barrier 없음 — 페이지 독립 ──
phase('Graft')
const tier1 = await pipeline(
  PAGES,
  (m) => agent(`${CONTRACT}

[1.5 인벤토리 + 3 grafting] 한 페이지.${m.risk ? ` risk=${m.risk}.` : ''}
원본 JSP : ${SRC}/${m.jsp}   (★READ-ONLY★)
납품 HTML: ${SRC}/${m.html}
산출 경로 : ${SRC}/${m.out}   (여기에 Write)
${m.watchFor ? `\n이 페이지 특히 조심(정찰 perPageRisk):\n${m.watchFor}` : ''}${m.mockup ? `\n환원 대상 목업: ${m.mockup}` : ''}

순서:
1. 원본 JSP Read -> 보존할 동적요소 전수 인벤토리(EL/JSTL/스크립틀릿쌍/커스텀태그/include/form name/속성내 EL).
2. 납품 HTML Read -> 콘텐츠 컨테이너(<main class="content"> 등) *내부*의 본문 마크업만 사용. ★컨테이너 태그 자체(<main>)는 chrome(C단계)이 소유하므로 산출물에 포함하지 마라 — 포함하면 중첩 버그.
3. grafting: 납품 본문으로 교체 + 인벤토리 동적바인딩 전부 재주입. 목업 샘플데이터를 c:forEach+EL/커스텀태그로 환원.
4. charset 정찰 charsetAction대로.
5. ${SRC}/${m.out} 에 Write. 산출물 최상위는 콘텐츠 요소(h1 등)로 시작 — <main>으로 시작 금지.
반환: page/outPath/inventory/mockupReverted/charsetFixed/note.`,
    { label: `graft:${m.wbs}`, phase: 'Graft', schema: GRAFT_SCHEMA }).then(r => ({ m, graft: r })),
  (prev, m) => agent(`너는 독립 정적 리뷰어. grafting 결과가 동적바인딩을 하나도 안 빠뜨렸는지, 목업 잔존·chrome 경계 위반이 있는지 적대적으로 검증하라.

원본 JSP(기준): ${SRC}/${m.jsp}
산출 JSP(대상): ${SRC}/${m.out}
납품 HTML: ${SRC}/${m.html}
graft 담당 보고 인벤토리: ${prev && prev.graft ? JSON.stringify(prev.graft.inventory) : '(graft 실패)'}

검증(Read+Grep 실제 대조):
1. bindingsMissing: 원본의 EL·JSTL·스크립틀릿쌍·커스텀태그·form name·include 중 산출물에서 빠진 것.
2. mockupLeftover: 납품 샘플데이터(${m.mockup || '이름/사번/날짜 등 더미'})가 산출물에 하드코딩으로 남았는지.
3. charsetOk: 선언이 정찰 방향(보통 UTF-8)과 일치하고 EUC-KR 선언 잔존 없는지.
4. chromeBoundaryOk: 산출물이 chrome 소유 컨테이너(<main class="content">/#container)를 *중복으로 열지* 않는지. 산출물(include header 이후)이 <main> 또는 컨테이너 여는 태그로 본문을 감싸면 chrome의 것과 중첩되는 버그 — 그러면 false. (Grep '<main' 산출물에서 0이어야 정상)
result는 bindingsMissing·mockupLeftover 모두 빈배열 + charsetOk=true + chromeBoundaryOk=true 일 때만 'pass'.`,
    { label: `review:${m.wbs}`, phase: 'Review', schema: REVIEW_SCHEMA }).then(r => ({ ...prev, review: r }))
)

const pages = tier1.filter(Boolean)
const passed = pages.filter(p => p.review && p.review.result === 'pass')
log(`Tier1 정적: pass ${passed.length} / fail ${pages.length - passed.length}`)

// ── Tier2: 동적 /qa+/browse — 단일앱 직렬. 앱 부재면 보류(하드게이트) ──
if (APP_BOOTABLE && passed.length) log('Tier2 동적 /qa 직렬 (실행환경 필요 — 미구현 훅)')
else log('Tier2 보류 — 앱 구동 불가(백엔드/톰캣 부재 등). 동적검증 실딜리버리로 이월.')

// ── 취합: WBS 미러 + reports/ 기록 ──
phase('Synthesize')
const synth = await agent(`너는 취합 담당. grafting 팬아웃 결과를 WBS 미러 리포트로 정리하고 파일로 남겨라.

프로젝트: ${SRC}
chrome 결과: ${JSON.stringify(chromeResult)}
페이지 결과: ${JSON.stringify(pages.map(p => ({ wbs: p.m.wbs, jsp: p.m.jsp, html: p.m.html, out: p.m.out, graft: p.graft, review: p.review })), null, 2)}
동적 qa: ${APP_BOOTABLE ? '수행 가능' : '보류(앱 부재 — 하드게이트 미충족)'}

할 일:
1. WBS 미러 표: 행 = chrome(1.0, 있으면) + 각 페이지. 컬럼 = WBS키/페이지(JSP<-납품)/적용/정적review/동적qa/상태.
   상태: 정적 pass & 동적보류 = "정적 PASS / 동적 보류(앱부재)". 정적 fail = "보류(사람)".
2. 정적 PASS 근거(목업0/바인딩누락0/charset정정/chrome경계OK) + 동적 보류 사유.
3. grafting 결정·openQuestions를 실딜리버리 확인용으로 정리.
4. Write (src/ 절대 금지, reports/ 에만):
   - ${SRC}/reports/wbs-report.md
   - ${SRC}/reports/pages/<페이지명>.json  (페이지명 = jsp 파일명 확장자 제외. 인벤토리+정적결과+동적상태)
반환: wbsMarkdown/summary/triage.`,
  { label: 'wbs', phase: 'Synthesize', schema: WBS_SCHEMA })

return { chrome: chromeResult, pages: pages.map(p => ({ wbs: p.m.wbs, review: p.review && p.review.result })), wbs: synth, gate: '사람 게이트 — 자동 푸시 없음. triage 보고 사람이 출하 결정.' }
