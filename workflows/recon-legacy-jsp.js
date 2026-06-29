export const meta = {
  name: 'recon-legacy-jsp',
  description: 'Read-only structural recon of a legacy JSP codebase: catalogs taglibs, maps include/chrome tree, surveys scriptlet/binding patterns, inventories target pages with charset/JSTL version. Synthesizes a recon report that feeds JSP re-skinning (옷입히기) work. Run when source arrives: Workflow({scriptPath, args:{sourcePath, targetPages?}}).',
  phases: [
    { title: 'Analyze', detail: '4 parallel read-only lenses over the legacy source' },
    { title: 'Synthesize', detail: 'consolidate lenses into one recon report + decisions' },
  ],
}

// ── 입력 ──────────────────────────────────────────────
// args.sourcePath : 레거시 소스 루트 (필수, 소스 도착 시 주입)
// args.targetPages: 옷입힐 대상 JSP 목록 (선택 — 업체 매핑 오면 주입)
const SRC = (args && args.sourcePath) || '.'
const TARGETS = (args && args.targetPages) || null

const COMMON = `
READ-ONLY 구조 정찰. 대상: 레거시 JSP 웹앱, 경로 = ${SRC}
${TARGETS
  ? `옷입힐(re-skin) 대상 페이지(focus):\n${JSON.stringify(TARGETS)}`
  : '재skin 대상 페이지는 아직 미지정 — 넓게 인벤토리하고 후보를 플래그.'}

규칙:
- READ-ONLY. 파일 편집/생성/삭제 금지. 비파괴 조사만 (Glob/Grep/Read + charset 확인용 file/hexdump 같은 읽기 전용 명령 허용).
- charset은 inventory 렌즈(④)가 실제 바이트로 최종판단 — 다른 렌즈는 선언 기준 언급만, 단정 금지.
- 이 정찰은 후속작업을 위한 것: 납품된 정적 HTML+CSS 디자인을 이 JSP들에 입히되
  동적 바인딩을 보존하는 grafting. 그래서 초점은 "마크업 갈아끼우기 전에 반드시
  이해/보존해야 할 것".
- 구체적으로: 파일 경로 인용. 판단 불가한 건 추측하지 말고 "불명"으로 표기.
`

// ── 렌즈 정의 ────────────────────────────────────────
const LENSES = [
  {
    key: 'taglibs',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['taglibs', 'risingFlags', 'notes'],
      properties: {
        taglibs: {
          type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['prefix', 'uri', 'tags'],
            properties: {
              prefix: { type: 'string' },
              uri: { type: 'string' },
              tldPath: { type: 'string' },
              tags: {
                type: 'array', items: {
                  type: 'object', additionalProperties: false,
                  required: ['name', 'dynamic', 'purpose'],
                  properties: {
                    name: { type: 'string' },
                    dynamic: { type: 'boolean', description: '동적출력이면 true (보존 필수) / 순수 정적 래퍼면 false' },
                    purpose: { type: 'string' },
                    preserveNote: { type: 'string', description: 'grafting 때 이 태그를 어떻게 보존할지' },
                  },
                },
              },
            },
          },
        },
        risingFlags: { type: 'array', items: { type: 'string' }, description: '블라인드 치환 시 깨질 위험이 큰 커스텀태그/패턴' },
        notes: { type: 'string' },
      },
    },
    prompt: `${COMMON}

렌즈 ①: TAGLIB / TLD 카탈로그.
- web.xml, *.tld, JSP의 <%@ taglib %> 선언을 전수 조사.
- 각 커스텀 태그가 "동적 출력(보존 필수)"인지 "정적 래퍼"인지 판별 (TLD/태그핸들러까지 추적).
- 표준 JSTL(c:, fmt:, fn:)도 prefix만 정리.
- 목표: grafting 에이전트가 "이 태그는 데이터를 뱉으니 절대 정적치환 금지"를 알게 하는 것.`,
  },
  {
    key: 'chrome',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['layoutFramework', 'chromeFiles', 'sharedVsPage', 'notes'],
      properties: {
        layoutFramework: { type: 'string', enum: ['tiles', 'sitemesh', 'decorator-other', 'plain-include', 'none', 'unknown'] },
        chromeFiles: {
          type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['path', 'role'],
            properties: {
              path: { type: 'string' },
              role: { type: 'string', enum: ['header', 'footer', 'menu', 'layout', 'common-other'] },
            },
          },
        },
        includeEdges: {
          type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['page', 'includes'],
            properties: { page: { type: 'string' }, includes: { type: 'array', items: { type: 'string' } } },
          },
        },
        sharedVsPage: {
          type: 'object', additionalProperties: false,
          required: ['sharedChrome', 'pageBodies'],
          properties: {
            sharedChrome: { type: 'array', items: { type: 'string' }, description: '한 번만 입히면 전 페이지 상속되는 공유파일' },
            pageBodies: { type: 'array', items: { type: 'string' }, description: '페이지별 개별 작업 대상' },
          },
        },
        notes: { type: 'string' },
      },
    },
    prompt: `${COMMON}

렌즈 ②: INCLUDE / CHROME 트리.
- <%@ include %>, <jsp:include>, Tiles/SiteMesh/decorator 사용 여부 전수 조사.
- 공유 chrome(헤더/푸터/메뉴/레이아웃) 파일을 식별 → "한 번만 입히면 되는 것"과 "페이지별 body"를 분리.
- 목표: grafting을 "공유 chrome 1회 선처리 → 페이지 body 개별"로 나눌 근거 제공.
  (공유파일을 페이지마다 건드리면 충돌남)`,
  },
  {
    key: 'patterns',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['scriptletUsage', 'idioms', 'notes'],
      properties: {
        scriptletUsage: { type: 'string', enum: ['heavy', 'moderate', 'light', 'none', 'unknown'] },
        idioms: {
          type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['name', 'preserveRule'],
            properties: {
              name: { type: 'string', description: '예: 권한조건부 표시, 페이징, 폼 post, 목록 루프' },
              example: { type: 'string', description: '대표 코드조각(짧게)' },
              preserveRule: { type: 'string', description: 'grafting 때 이 관용구를 어떻게 보존하는가' },
            },
          },
        },
        elJstlConventions: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
    },
    prompt: `${COMMON}

렌즈 ③: 스크립틀릿 / 바인딩 패턴.
- <% ... %> 스크립틀릿 사용 강도, 그리고 반복되는 관용구를 수집:
  권한별 조건부 마크업, 페이징, 폼 post, 목록 루프(c:forEach), 속성 안 EL(value="\${..}") 등.
- 각 관용구마다 "grafting 시 보존 규칙"을 한 줄로.
- 목표: 페이지마다 똑같은 실수 반복 방지 — 공통 패턴을 한 번 이해해 15페이지에 적용.`,
  },
  {
    key: 'inventory',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['charsetOverall', 'pages', 'notes'],
      properties: {
        charsetOverall: { type: 'string', description: 'EUC-KR / UTF-8 / 혼재 / 불명' },
        jstlVersion: { type: 'string' },
        javaVersion: { type: 'string' },
        servletJspVersion: { type: 'string' },
        pages: {
          type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['path', 'charset', 'hasScriptlet', 'hasCustomTags'],
            properties: {
              path: { type: 'string' },
              charset: { type: 'string' },
              hasScriptlet: { type: 'boolean' },
              hasCustomTags: { type: 'boolean' },
              includes: { type: 'array', items: { type: 'string' } },
              riskLevel: { type: 'string', enum: ['low', 'medium', 'high'], description: 'grafting 난이도(스크립틀릿/커스텀태그/include 많을수록 high)' },
            },
          },
        },
        notes: { type: 'string' },
      },
    },
    prompt: `${COMMON}

렌즈 ④: 페이지 인벤토리 + charset/버전.
- 대상 JSP(미지정이면 전체 .jsp) 목록화. 각 페이지: charset, 스크립틀릿 유무,
  커스텀태그 유무, include 목록, grafting 난이도(low/medium/high).
- ★charset은 선언부(page contentType/pageEncoding/<meta>)만 믿지 말 것. file/hexdump로 실제
  파일 바이트 인코딩을 확인하라. 선언≠실제면 둘 다 기록(예: "선언 EUC-KR / 실제 UTF-8").
  한글깨짐의 진짜 원인은 실제 바이트 vs 납품 HTML(보통 UTF-8) 불일치다.
- 프로젝트 전체 charset, JSTL/Java/Servlet-JSP 버전을 web.xml·pom.xml·build.gradle·*.jsp 헤더에서 탐지.
- 목표: charset 한글깨짐 지뢰 사전탐지 + 페이지별 난이도 분류(작업 순서/배분 근거).`,
  },
]

// ── Phase 1: 4 렌즈 병렬 (barrier — 합성이 4개 다 필요) ──
phase('Analyze')
log(`레거시 JSP 구조 정찰 시작 — 소스: ${SRC}`)

const lensResults = await parallel(
  LENSES.map(l => () =>
    agent(l.prompt, { label: `lens:${l.key}`, phase: 'Analyze', schema: l.schema })
      .then(r => ({ key: l.key, result: r }))
  )
)

const ok = lensResults.filter(x => x && x.result)
log(`렌즈 ${ok.length}/4 완료`)

// ── Phase 2: 합성 ──
phase('Synthesize')

const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['reportMarkdown', 'decisions', 'perPageRisk', 'openQuestions'],
  properties: {
    reportMarkdown: { type: 'string', description: '사람이 읽는 구조 정찰 리포트 (마크다운). 4렌즈 통합.' },
    decisions: {
      type: 'object', additionalProperties: false,
      required: ['chromeFirst', 'charsetAction', 'taglibsToPreserve'],
      properties: {
        chromeFirst: { type: 'string', description: '공유 chrome 선처리 대상 파일들 + 처리방침' },
        charsetAction: { type: 'string', description: 'charset 불일치 대응 (변환 필요 여부/방향)' },
        taglibsToPreserve: { type: 'array', items: { type: 'string' }, description: '절대 정적치환 금지인 동적 커스텀태그' },
      },
    },
    perPageRisk: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['page', 'risk', 'watchFor'],
        properties: {
          page: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          watchFor: { type: 'string', description: '이 페이지 grafting 시 특히 조심할 것' },
        },
      },
    },
    openQuestions: { type: 'array', items: { type: 'string' }, description: '소스만으론 못 정한 것 / 사람에게 확인할 것' },
  },
}

const synthesis = await agent(
  `${COMMON}

너는 합성 담당. 아래 4개 렌즈의 구조 정찰 결과(JSON)를 통합해서,
JSP 옷입히기(grafting) 작업이 바로 참조할 "구조 정찰 리포트 + 결정사항"을 만들어라.

핵심 산출:
- reportMarkdown: 사람이 읽는 통합 리포트.
- decisions: ① 공유 chrome 선처리 대상 ② charset 대응 ③ 보존필수 동적 태그 목록.
- perPageRisk: 페이지별 난이도 + grafting 시 조심할 점.
- openQuestions: 소스만으론 못 정한 것(매핑/타겟브라우저 등) — 사람 확인용.

★저장: 구조화 출력으로 반환하기 전에, Write 도구로 산출을 파일로 남겨라.
  - recon/recon-report.json  ← 통합 결과(JSON 전체)
  - recon/recon-report.md    ← reportMarkdown (사람이 읽는 통합 리포트)
  (이 정찰만 READ-ONLY 예외 — src/는 절대 안 건드리고, recon/ 에만 쓴다.)

렌즈 결과:
${JSON.stringify(ok, null, 2)}`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA }
)

return { lenses: ok, recon: synthesis }
