# THE GAZE — Vercel + Supabase 배포 가이드

로그인 없이 모든 관람객의 설문 응답이 하나의 DB에 쌓이고, 통계는 그 DB 값으로만 계산됩니다.

```
index.html        웹사이트 (그대로 배포)
api/submit.js     설문 저장 (POST /api/submit)
api/stats.js      누적 응답 수 + 통계 집계 (GET /api/stats)
supabase.sql      DB 테이블 + 집계 함수 (한 번만 실행)
.env.example      환경변수 이름 예시
```

## 1. Supabase 준비 (약 3분)
1. https://supabase.com 에서 새 프로젝트 생성
2. 왼쪽 **SQL Editor → New query** 에 `supabase.sql` 내용을 붙여넣고 **Run**
3. **Project Settings → API** 에서 두 값을 복사
   - Project URL → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (비밀 키. 브라우저/코드/GitHub에 절대 넣지 마세요)

## 2. Vercel 배포
1. 이 폴더를 GitHub 저장소에 올리고 Vercel에서 **Add New → Project → Import**
   (또는 폴더에서 `npx vercel` 실행)
2. **Settings → Environment Variables** 에 아래 2개를 Production / Preview / Development 모두에 추가
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. 환경변수를 추가한 뒤 **Redeploy** (환경변수는 새 배포부터 적용됩니다)

## 3. 배포 후 확인 (직접 해 보세요)
```bash
# 1) 빈 상태
curl https://YOUR-SITE.vercel.app/api/stats
# → {"n":0,"a":0,"b":0}

# 2) 저장 테스트 (cid는 16자 이상 영문/숫자/-)
curl -X POST https://YOUR-SITE.vercel.app/api/submit \
  -H "Content-Type: application/json" \
  -d '{"cid":"test-0000-0000-0001","answers":[5,5,5,1,1,1]}'
# → {"ok":true,"duplicate":false}   (같은 요청을 다시 보내면 duplicate:true, 수는 그대로)

# 3) 다시 조회
curl https://YOUR-SITE.vercel.app/api/stats
# → {"n":1,"a":3,"b":3}
```
체크리스트
- [ ] 휴대폰/아이패드/PC에서 각각 설문 제출 → 세 기기 모두 같은 「현재 누적 응답 N명」
- [ ] 제출 직후 통계 페이지의 N이 1 증가 (설문 중 이탈하면 증가하지 않음)
- [ ] 새로고침 후에도 N과 퍼센트가 그대로
- [ ] Supabase **Table Editor → responses** 의 행 수 = 화면의 N

테스트 데이터 삭제(전시 시작 전): SQL Editor에서 `truncate table public.responses restart identity;`

## 동작 방식
- 관람객은 로그인하지 않습니다. 페이지를 열 때마다 임의의 방문 ID(메모리, localStorage 아님)가 생기고, 제출 시 서버가 DB 고유값으로 같은 방문의 중복 저장(더블 탭, 재시도)을 막습니다.
- 전시장의 한 대의 아이패드에서 계속 이어서 받아도, 「처음으로」로 새로고침될 때마다 새 방문이 되어 각각 집계됩니다.
- 응답은 서버(`/api/submit`)가 service_role 키로만 저장합니다. 브라우저는 DB에 직접 접근하지 못합니다(RLS 켜짐, anon 권한 없음).
- 통계 1 = Q1~3에서 「보통이다/그렇다/매우 그렇다」 비율, 통계 2 = Q4~6에서 「전혀/그렇지 않다/보통이다」 비율. 둘 다 저장된 응답에서 계산합니다.
- 통계 페이지는 8초마다 서버 값을 다시 불러옵니다.
- claude.ai 미리보기에서 열면 같은 index.html이 자동으로 claude.ai 내장 저장소를 사용합니다(별도 설정 불필요).

## 문제 해결 — "저장에 실패했습니다" 가 뜰 때
메시지 끝의 괄호 코드와 `/api/health` 로 원인을 바로 알 수 있습니다.

브라우저에서 `https://내사이트.vercel.app/api/health` 를 여세요 (비밀 키는 표시되지 않습니다).

| 보이는 결과 | 원인 | 해결 |
|---|---|---|
| 404 페이지 / `http_404` | api 폴더가 배포되지 않음 (index.html만 올렸거나, Vercel Root Directory가 잘못됨) | 폴더 전체를 올리고, Settings → General → Root Directory 가 `index.html` 과 `api/` 가 있는 폴더인지 확인 |
| `env_missing` / `server_not_configured` | 환경변수 없음 또는 추가 후 재배포 안 함 | Settings → Environment Variables 에 2개 추가 → **Redeploy** |
| `key_type` 에 WRONG | publishable/anon 키를 넣음 | Supabase → Project Settings → API 의 **secret / service_role** 키로 교체 |
| `url_host` 에 INVALID_URL | URL 형식 오류 | `https://xxxx.supabase.co` 형태 (끝에 `/rest/v1` 불필요) |
| `table_http` 404 · `function_http` 404 | `supabase.sql` 미실행 | SQL Editor에서 `supabase.sql` 전체를 Run |
| `function_http` 401/403 | 키가 틀림 | 키를 다시 복사 (앞뒤 공백/줄바꿈 주의) |
| `status: "ok"` 인데도 실패 | 코드가 알려줌 | 저장 실패 문구 끝 괄호 코드 (예: `database_error_409`) 를 알려 주세요 |

정상이면 `/api/health` 에 `"status": "ok"` 와 `"stats": {"n":0,...}` 가 보입니다. 오픈 전에 `api/health.js` 는 삭제해도 됩니다.
