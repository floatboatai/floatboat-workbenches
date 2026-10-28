# React Email upstream materials

Official repository: https://github.com/resend/react-email
Tag: react-email@6.11.4
Commit: 2e3c28c89a4ee18bd302325f51d5cf4f93c7ea06
License: MIT (verbatim in react-email.LICENSE)

Selected official components and their recursive helpers are retained unchanged in react-email-source. react-email-provenance.json records every source and generated module SHA-256, exact source root and external imports. TypeScript5.9.3 only transpiles JSX/types; generated JS and declarations live in src/server/vendor. No third-party code is covered by the original-integration app/LICENSE.

Runtime rendering uses unmodified @react-email/render2.1.1 (MIT); its license is render.LICENSE. React/ReactDOM19.2.3 retain their MIT distributions. The pinned Floatboat template and SDK retain their upstream terms. No upstream examples, photography or webfonts are included.

Sources verified 2026-10-28: https://react.email/docs/utilities/render ; https://react.email/docs/components/button ; npm metadata for react-email6.11.4 and @react-email/render2.1.1 ; immutable GitHub source commit above.
