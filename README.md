# jengros Redmine MCP

독립 유지보수 저장소: https://github.com/jengros/redmine-mcp-server

원본: [onozaty/redmine-mcp-server](https://github.com/onozaty/redmine-mcp-server).
원본 저작권 및 MIT 라이선스를 유지합니다. npm에 게시된 원본 패키지는 변경하지 않습니다.

## 추가 기능: 일감 수정과 소요시간 기록을 한 번에

기존 `updateIssue`의 `bodyParams`에 선택 항목 `time_entry`를 추가했습니다.
댓글, 상태, 담당자, 소요시간을 한 번의 `PUT /issues/{id}.json`으로 전달합니다.
`createTimeEntry`를 추가 호출하지 않으며, `time_entry`가 없으면 기존 호출과 같습니다.

```json
{
  "pathParams": { "format": "json", "issueId": 123 },
  "bodyParams": {
    "issue": { "notes": "작업 완료", "status_id": 3, "assigned_to_id": 7 },
    "time_entry": { "hours": 1, "activity_id": 9, "spent_on": "2026-09-10" }
  }
}
```

위 ID와 날짜는 예시입니다. 상태·담당자·활동은 대상 서버에서 확인한 값을 사용합니다.
담당자를 등록자로 변경하는 등 업무 규칙을 도구에 자동 적용하지 않습니다.
생략한 날짜·활동은 Redmine 서버 기본 처리에 따르며, 활동이 필수인 서버는 유효한 ID를 지정해야 합니다.

Redmine의 일감 수정 컨트롤러가 최상위 `time_entry`를 처리하는 서버에서 사용합니다.
[공식 구현](https://github.com/redmine/redmine/blob/master/app/controllers/issues_controller.rb)의
`save_issue_with_child_records`가 일감·시간 기록을 함께 저장합니다.
서버 버전·플러그인·권한에 따라 동작이 달라질 수 있고, 시간 기록 권한이 없으면 서버가 해당 항목을 무시할 수 있습니다.
따라서 성공 응답 후 일감 댓글/상태/담당자와 시간 기록을 각각 재조회해야 합니다.
이 도구는 검증 GET을 자동 수행하거나 서버 트랜잭션을 보장하지 않습니다.
HTTP 오류는 MCP 오류로 반환하며 응답 유실 시 쓰기를 자동 재시도하지 않습니다.
응답 유실 시 실제 저장 여부를 먼저 확인해 중복 댓글·시간 기록을 방지합니다.

## npm 패키지 실행

배포된 버전은 다음 명령으로 실행합니다.

```sh
npx -y @jengros/redmine-mcp-server
```

MCP 설정은 command를 npx, args를 ["-y", "@jengros/redmine-mcp-server"]로 지정합니다.
기존 환경 변수와 인증정보는 유지합니다. 버전 생략 시 npm의 latest 태그를 사용하며, 실행 중인 MCP는 업데이트 후 재시작합니다.

## 이 수정본 빌드 및 실행

Node.js 22 이상과 저장소에 지정된 pnpm 10.20.0을 사용합니다.
Windows에서도 같은 명령으로 빌드할 수 있습니다.

```sh
npx --yes pnpm@10.20.0 install --frozen-lockfile
npm run build
npm test
```

MCP 연결에서 `command`는 `node`, `args`는 빌드한 `dist/server.mjs`의 절대 경로로 지정합니다.
기존 환경 변수 `REDMINE_URL`, `REDMINE_API_KEY`와 읽기/쓰기 설정은 유지합니다.
실제 인증키·서버 정보는 저장소에 넣지 않습니다.
GitHub에서 소스만 받은 상태로 `npx github:...`를 실행하는 방식은 지원하지 않습니다. 먼저 위 명령으로 빌드합니다.

## npm 배포: GitHub Actions OIDC

npm 11.15.0 이상에서 로그인 후 다음 명령으로 신뢰 연결을 등록하고 조회할 수 있습니다.
계정 2FA와 패키지 쓰기 권한이 필요합니다.

```sh
npm trust github @jengros/redmine-mcp-server --file=publish.yml --repo=jengros/redmine-mcp-server --allow-publish --yes
npm trust list @jengros/redmine-mcp-server
```

웹에서 등록하려면 npm 패키지 Settings → Trusted Publisher에 다음 값을 사용합니다.

- Provider: GitHub Actions
- Organization or user: jengros
- Repository: redmine-mcp-server
- Workflow filename: publish.yml
- Environment name: 비워 둠
- Allowed actions: npm publish 허용

장기 npm 토큰이나 NODE_AUTH_TOKEN을 GitHub Secrets에 등록하지 않습니다.
패키지가 아직 없으면 최초 등록을 완료한 뒤 패키지 설정에서 신뢰 관계를 등록합니다.
공식 절차: https://docs.npmjs.com/trusted-publishers/

package.json 버전과 같은 v태그(예: v1.3.2)를 올리면 배포합니다.
워크플로는 저장소·태그·패키지 이름을 검사하고 고정된 의존성을 설치한 뒤 빌드와 테스트를 통과해야 배포합니다.
GitHub 호스팅 Ubuntu, Node 22, npm 11.17.0과 id-token: write 권한을 사용합니다.
수동 재실행도 해당 버전 태그를 선택해야 합니다. main에서 실행하면 배포 작업을 건너뜁니다.
이미 배포한 버전은 덮어쓸 수 없으므로 신규 버전과 태그를 사용합니다.

## 유지보수와 검증

- `origin`: 이 개인 저장소, `upstream`: 원본 저장소로 관리합니다.
- API 변경은 `redmine-openapi.yaml`에서 수정합니다. `src/__generated__`와 `dist`는 빌드 결과이므로 직접 관리하지 않습니다.
- 원본 변경을 가져올 때 스키마·커스텀 핸들러·빌드 스크립트의 차이를 보존하고 빌드/테스트 후 반영합니다.
- CI는 Windows와 Linux에서 빌드 및 테스트합니다. npm은 버전 태그를 통해 OIDC로 배포합니다.
- 테스트는 빌드된 MCP와 로컬 모의 HTTP 서버 사이에서 수행하며 실제 Redmine/인증키를 사용하지 않습니다.
- 단일 PUT, 댓글 전용 호출, 최소 시간 입력, 잘못된 입력, HTTP 오류, 응답 유실, 읽기 전용/도구 필터를 검증합니다.
- 실제 Redmine 서버에서의 통합 저장과 조회 검증은 별도로 필요합니다.

## 환경 변수

| 변수 | 용도 |
|---|---|
| REDMINE_URL | 필수. Redmine 기본 URL |
| REDMINE_API_KEY | 필수. 사용할 계정의 API 키 |
| REDMINE_MCP_READ_ONLY | true이면 쓰기 도구 제외. 기본은 쓰기 허용 |
| REDMINE_MCP_TOOLS_ALLOW_PATTERN | 허용할 도구 이름의 정규식. 생략하면 제한 없음 |
| REDMINE_MCP_TOOLS_DENY_PATTERN | 제외할 도구 이름의 정규식. 허용 패턴보다 우선 |

읽기 전용 설정과 도구 필터를 함께 적용할 수 있습니다. 인증정보는 MCP 클라이언트에서 관리합니다.

## 주요 기능과 코드 구조

일감·프로젝트·사용자·시간 기록·위키 등 Redmine API 도구와 첨부 업로드·다운로드 도구를 제공합니다.
각 도구는 readOnlyHint를 제공하며, src/server.ts에서 등록과 필터를 적용합니다.

- redmine-openapi.yaml → orval.config.ts → 자동 생성 코드 → post-generate.js 순서로 API 코드를 생성합니다.
- src/issue/update-issue-handler.ts: 시간 기록을 포함한 일감 수정과 HTTP 오류 처리.
- src/attachment/, src/schemas/attachment.ts, src/types/attachment.ts: 첨부 처리 구현·스키마·타입.
- src/config.ts: 환경 변수와 도구 필터.
- src/api/custom-fetch.ts: Redmine HTTP 요청.
- test/update-issue.test.mjs: 빌드된 MCP와 모의 서버 사이의 통합 테스트.

자동 생성 코드와 dist를 직접 수정하지 않고 스키마 또는 원본 소스를 수정한 뒤 빌드합니다.

## 라이선스와 출처

MIT 라이선스. 원저작자 onozaty의 저작권 고지는 LICENSE에 유지합니다.
원본 프로젝트: https://github.com/onozaty/redmine-mcp-server
OpenAPI 원본: https://github.com/d-yoshi/redmine-openapi
코드 생성 도구: https://orval.dev/
