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
npx -y @jengros/redmine-mcp-server@1.3.1
```

MCP 설정은 command를 npx, args를 ["-y", "@jengros/redmine-mcp-server@1.3.1"]로 지정합니다.
기존 환경 변수와 인증정보는 유지합니다. 버전을 고정하며 업데이트 시 검증한 버전으로 변경합니다.

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
아래 원본 README의 `npx @onozaty/...` 명령은 원본 패키지를 실행하므로 이 수정본의 변경은 포함하지 않습니다.
GitHub에서 소스만 받은 상태로 `npx github:...`를 실행하는 방식은 지원하지 않습니다. 먼저 위 명령으로 빌드합니다.

## npm 배포: GitHub Actions OIDC

npm 패키지 Settings → Trusted Publisher에 다음 값을 등록합니다.

- Provider: GitHub Actions
- Organization or user: jengros
- Repository: redmine-mcp-server
- Workflow filename: publish.yml
- Environment name: 비워 둠
- Allowed actions: npm publish 허용

장기 npm 토큰이나 NODE_AUTH_TOKEN을 GitHub Secrets에 등록하지 않습니다.
패키지가 아직 없으면 최초 등록을 완료한 뒤 패키지 설정에서 신뢰 관계를 등록합니다.
공식 절차: https://docs.npmjs.com/trusted-publishers/

package.json 버전과 같은 v태그(예: v1.3.1)를 올리면 배포합니다.
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

---

아래는 원본 프로젝트 설명입니다.

# Redmine MCP Server

Model Context Protocol (MCP) server for Redmine that provides comprehensive access to the Redmine REST API.

## Overview

This project is an MCP server that comprehensively covers Redmine's [REST API](https://www.redmine.org/projects/redmine/wiki/rest_api). It allows you to operate Redmine from MCP clients (such as Claude Desktop).

## Demonstration

Here are example videos showing how to use the Redmine MCP server with Claude Desktop:

### Creating an Issue

https://github.com/user-attachments/assets/075fb079-104c-404d-91f5-755b3882853b

*This demonstration also uses the [Playwright MCP](https://github.com/microsoft/playwright-mcp) for browser automation alongside the Redmine MCP server.*

### Getting Issue Information

https://github.com/user-attachments/assets/8f551082-6982-4513-8fe7-b0f111be982d

## Features

- 📋 **Comprehensive API Coverage**: Supports all functions available in Redmine's REST API
- 🔒 **Read-Only Mode**: Supports safe data reference mode
- 🔧 **Tool Filtering**: Control which tools are available using regex patterns
- 🏷️ **Tool Annotations**: Declares `readOnlyHint` so clients can tell read operations from write ones

## Prerequisites

### Getting Redmine API Key

1. Log in to Redmine with administrator privileges
2. Go to "Administration" → "Settings" → "API" tab
3. Check "Enable REST web service"
4. Generate "API access key" in personal settings

For details, refer to [Redmine REST API documentation](https://www.redmine.org/projects/redmine/wiki/rest_api#Authentication).

## Configuration

### Environment Variables

The following environment variables are required (specified in MCP client configuration files):

- **REDMINE_URL** (Required): Base URL of the Redmine instance
  - Example: `https://redmine.example.com`
- **REDMINE_API_KEY** (Required): API key generated in Redmine
  - Set the API key obtained in prerequisites
- **REDMINE_MCP_READ_ONLY** (Optional): Enable read-only mode
  - `true`: Read-only mode (disables data modification operations)
  - `false` or unset: Allow all operations (default)
- **REDMINE_MCP_TOOLS_ALLOW_PATTERN** (Optional): Regex pattern to allow only matching tools
  - Example: `^get` (enable only tools starting with "get")
  - If unset, all tools are allowed (subject to other settings)
- **REDMINE_MCP_TOOLS_DENY_PATTERN** (Optional): Regex pattern to disable matching tools
  - Example: `^delete` (disable all tools starting with "delete")
  - If unset, no tools are denied (subject to other settings)
  - Deny pattern takes priority over allow pattern

### MCP Client Configuration

#### Using npx (Recommended for quick start)

Add the following as MCP configuration for your AI agent:

```json
{
  "mcpServers": {
    "redmine": {
      "command": "npx",
      "args": ["-y", "@onozaty/redmine-mcp-server"],
      "env": {
        "REDMINE_URL": "https://your-redmine.example.com",
        "REDMINE_API_KEY": "your-api-key-here",
        "REDMINE_MCP_READ_ONLY": "true"
      }
    }
  }
}
```

#### Using Docker (Alternative)

If you prefer using Docker:

```json
{
  "mcpServers": {
    "redmine": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "REDMINE_URL=https://your-redmine.example.com",
        "-e", "REDMINE_API_KEY=your-api-key-here",
        "-e", "REDMINE_MCP_READ_ONLY=true",
        "ghcr.io/onozaty/redmine-mcp-server:latest"
      ]
    }
  }
}
```

**When to use Docker:**
- Enterprise environments requiring container isolation
- Reproducible deployments across different systems
- Environments where Node.js installation is restricted

Below are specific configuration methods for several MCP clients:

#### Claude Desktop

Add the following to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "redmine": {
      "command": "npx",
      "args": ["-y", "@onozaty/redmine-mcp-server"],
      "env": {
        "REDMINE_URL": "https://your-redmine.example.com",
        "REDMINE_API_KEY": "your-api-key-here",
        "REDMINE_MCP_READ_ONLY": "true"
      }
    }
  }
}
```

#### Claude Code

In Claude Code, you can add MCP servers using the following commands:

Local configuration:
```bash
claude mcp add redmine -e REDMINE_URL=https://your-redmine.example.com -e REDMINE_API_KEY=your-api-key-here -e REDMINE_MCP_READ_ONLY=true -- npx -y @onozaty/redmine-mcp-server
```

Project configuration:
```bash
claude mcp add -s project redmine -e REDMINE_URL=https://your-redmine.example.com -e REDMINE_API_KEY=your-api-key-here -e REDMINE_MCP_READ_ONLY=true -- npx -y @onozaty/redmine-mcp-server
```

User configuration (global):
```bash
claude mcp add -s user redmine -e REDMINE_URL=https://your-redmine.example.com -e REDMINE_API_KEY=your-api-key-here -e REDMINE_MCP_READ_ONLY=true -- npx -y @onozaty/redmine-mcp-server
```

#### Visual Studio Code

Project configuration (`.vscode/mcp.json`):

```json
{
  "servers": {
    "redmine": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@onozaty/redmine-mcp-server"],
      "env": {
        "REDMINE_URL": "https://your-redmine.example.com",
        "REDMINE_API_KEY": "your-api-key-here",
        "REDMINE_MCP_READ_ONLY": "true"
      }
    }
  }
}
```

User configuration (`settings.json`):

```json
{
  "mcp": {
    "servers": {
      "redmine": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@onozaty/redmine-mcp-server"],
        "env": {
          "REDMINE_URL": "https://your-redmine.example.com",
          "REDMINE_API_KEY": "your-api-key-here",
          "REDMINE_MCP_READ_ONLY": "true"
        }
      }
    }
  }
}
```

## Available Features

This MCP server comprehensively supports the functions provided by [Redmine's REST API](https://www.redmine.org/projects/redmine/wiki/rest_api):

### Main Features

- **Issues**: Create, update, delete, search, and manage related issues
- **Projects**: Create, update, delete, archive, and manage memberships
- **Users**: Create, update, delete, and manage groups
- **Time Entries**: Record, update, and delete time entries
- **Wiki**: Create, update, delete pages, and manage versions
- **News**: Create, update, and delete news
- **Files**: Upload and download files
- **Attachments**: Upload, download files, and get thumbnails
- **Queries**: Execute saved queries
- **Custom Fields**: Get and manage custom fields
- **Roles**: Get and manage roles
- **Trackers**: Get and manage trackers
- **Issue Statuses**: Get and manage issue statuses
- **Search**: Cross-search functionality

### Read-Only Mode

By setting `REDMINE_MCP_READ_ONLY=true`, you can disable data modification operations. This allows safe data reference.

### Tool Filtering

You can control which tools are available using the following environment variables:

- **`REDMINE_MCP_TOOLS_ALLOW_PATTERN`**: Only tools whose names match this regex are enabled.
  - Example: `^get` enables only read-oriented tools like `getIssues`, `getProjects`, etc.
- **`REDMINE_MCP_TOOLS_DENY_PATTERN`**: Tools whose names match this regex are disabled.
  - Example: `^delete` disables all delete operations.

When both are set, deny takes priority. These can also be combined with `REDMINE_MCP_READ_ONLY`.

**Example: Allow only issue-related tools**
```json
"env": {
  "REDMINE_MCP_TOOLS_ALLOW_PATTERN": "Issue"
}
```

**Example: Disable all delete and archive operations**
```json
"env": {
  "REDMINE_MCP_TOOLS_DENY_PATTERN": "^(delete|archive)"
}
```

### Tool Annotations

Every tool declares the `readOnlyHint` annotation, so clients do not have to guess from the tool name whether a call modifies data: it is `true` for read operations (`getIssues`, `getProjects`, ...) and `false` for the ones that create, update or delete. Clients that honour the annotation can, for instance, run read operations without asking the user for confirmation.

### Available Tools

The following tools are available (based on [Redmine REST API](https://www.redmine.org/projects/redmine/wiki/rest_api) categories):

| Category | Tools |
|---|---|
| Issues | getIssues, getIssue, createIssue, updateIssue, deleteIssue, addWatcher, removeWatcher, addRelatedIssue, removeRelatedIssue |
| Projects | getProjects, getProject, createProject, updateProject, deleteProject, archiveProject, unarchiveProject, closeProject, reopenProject |
| Project Memberships | getMemberships, getMembership, createMembership, updateMembership, deleteMembership |
| Users | getUsers, getUser, createUser, updateUser, deleteUser, getCurrentUser |
| Time Entries | getTimeEntries, getTimeEntry, createTimeEntry, updateTimeEntry, deleteTimeEntry |
| News | getNewsList, getNewsListByProject, getNews, createNews, updateNews, deleteNews |
| Issue Relations | getIssueRelations, getIssueRelation, createIssueRelation, deleteIssueRelation |
| Versions | getVersionsByProject, getVersions, createVersion, updateVersion, deleteVersion |
| Wiki Pages | getWikiPages, getWikiPage, getWikiPageByVersion, updateWikiPage, deleteWikiPage |
| Queries | getQueries |
| Attachments | getAttachment, updateAttachment, deleteAttachment, uploadAttachmentFromLocalFile, uploadAttachmentFromBase64Content, downloadAttachmentToLocalFile, downloadAttachmentAsBase64Content, downloadThumbnailToLocalFile, downloadThumbnailAsBase64Content |
| Issue Statuses | getIssueStatuses |
| Trackers | getTrackers |
| Enumerations | getIssuePriorities, getTimeEntryActivities, getDocumentCategories |
| Issue Categories | getIssueCategories, getIssueCategory, createIssueCategory, updateIssueCategory, deleteIssueCategory |
| Roles | getRoles, getRole |
| Groups | getGroups, getGroup, createGroup, updateGroup, deleteGroup, addUserToGroup, removeUserFromGroup |
| Custom Fields | getCustomFields |
| Search | search |
| Files | getFiles, createFile |
| My Account | getMyAccount, updateMyAccount |
| Journals | updateJournal |

## License

MIT License

## Author

[onozaty](https://github.com/onozaty)

## Acknowledgments

- OpenAPI specification: [d-yoshi/redmine-openapi](https://github.com/d-yoshi/redmine-openapi)
- Code generation: [Orval](https://orval.dev/) - TypeScript client and schema generator from OpenAPI
