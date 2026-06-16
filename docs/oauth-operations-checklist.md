# OAuth 운영 체크리스트

서비스 공개 전 운영자가 각 OAuth 콘솔에서 직접 확인할 항목입니다. 저장소에는 실제 secret 값을 기록하지 않습니다.

- 카카오, 네이버, 구글 개발자 콘솔의 앱 이름이 `책도장`으로 정리되어 있는지 확인한다.
- 리디렉션 URI가 운영 도메인 기준으로 등록되어 있는지 확인한다.
- localhost 또는 테스트 URI는 개발 환경에서만 사용되는지 확인한다.
- 개인정보처리방침 URL(`/privacy`)이 OAuth 콘솔에 등록되어 있는지 확인한다.
- 이용약관 URL(`/terms`)이 필요한 제공자 콘솔에 등록되어 있는지 확인한다.
- 요청 scope가 로그인과 서비스 제공에 필요한 최소 범위인지 확인한다.
- 제공받은 개인정보 중 실제로 사용하는 항목만 요청하는지 확인한다.
- 추가 개인정보 항목이 필요해지면 별도 검토 후 반영한다.

민감정보 검색 키워드:

- `KAKAO_CLIENT_SECRET`
- `NAVER_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `JWT_SECRET`
- `DB_PASSWORD`
- `AWS_ACCESS_KEY`
- `AWS_SECRET_ACCESS_KEY`
- `RDS`
- `DATABASE_URL`
- `TOSS_SECRET_KEY`
