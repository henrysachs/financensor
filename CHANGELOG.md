# [0.16.0](https://github.com/henrysachs/financensor/compare/v0.15.1...v0.16.0) (2026-05-07)


### Features

* repository seam, auth middleware, frontend decomposition, generated types ([2b1ecf7](https://github.com/henrysachs/financensor/commit/2b1ecf773d41768d9a63d39570404336cb1dfe5d))

## [0.15.1](https://github.com/henrysachs/financensor/compare/v0.15.0...v0.15.1) (2026-05-07)


### Bug Fixes

* SettlementsView fetches fresh purchases on mount ([21a9f0c](https://github.com/henrysachs/financensor/commit/21a9f0cb1674dc0128762aea533572d30d7e7d6e))

# [0.15.0](https://github.com/henrysachs/financensor/compare/v0.14.0...v0.15.0) (2026-05-07)


### Bug Fixes

* service worker must not intercept cross-origin requests ([4dc259e](https://github.com/henrysachs/financensor/commit/4dc259ef3980f4439b100583a84b66fb46238b02))
* switch Faro log output to JSON format ([167d5d8](https://github.com/henrysachs/financensor/commit/167d5d8271cf7f6fcf7ba8d5c4dc16c189aedcee))


### Features

* allow negative amountCents for refunds ([a56f1f1](https://github.com/henrysachs/financensor/commit/a56f1f1d7c037d878dfb3891a01c023884570239))

# [0.14.0](https://github.com/henrysachs/financensor/compare/v0.13.0...v0.14.0) (2026-05-05)


### Bug Fixes

* bump SW cache version, fix Loki max entry size, add no-cache to HTML ([d4ef704](https://github.com/henrysachs/financensor/commit/d4ef7045a15d575412af58f8d15c4c95031d8de2))


### Features

* add Frontend RUM Grafana dashboard ([6e3e487](https://github.com/henrysachs/financensor/commit/6e3e487627305b92ee5ec8f763915efa295bfd86))

# [0.13.0](https://github.com/henrysachs/financensor/compare/v0.12.0...v0.13.0) (2026-05-05)


### Features

* add Grafana Faro frontend observability ([7b70e69](https://github.com/henrysachs/financensor/commit/7b70e69d90ecfac852b498b19ddc85e407629451))

# [0.12.0](https://github.com/henrysachs/financensor/compare/v0.11.0...v0.12.0) (2026-05-05)


### Features

* add otelsql for automatic DB query tracing ([d8916af](https://github.com/henrysachs/financensor/commit/d8916af6ba3c57017c830258626be4dae7498e61))

# [0.11.0](https://github.com/henrysachs/financensor/compare/v0.10.0...v0.11.0) (2026-05-05)


### Features

* add DB query duration instrumentation ([4c11e4a](https://github.com/henrysachs/financensor/commit/4c11e4aec8d73ae7394285c1b7e2dcdc5a1c5135))

# [0.10.0](https://github.com/henrysachs/financensor/compare/v0.9.0...v0.10.0) (2026-05-05)


### Features

* add business metrics (purchases, groups, users created) ([3a228a2](https://github.com/henrysachs/financensor/commit/3a228a213fdbeccca0ffee84137d950a3d3c8f0b))

# [0.9.0](https://github.com/henrysachs/financensor/compare/v0.8.0...v0.9.0) (2026-05-05)


### Bug Fixes

* add script for local import ([c32722f](https://github.com/henrysachs/financensor/commit/c32722f1e42d2419d682b0052be227377f783a3a))


### Features

* add backend observability (metrics, structured logging, traceID) ([9768a6e](https://github.com/henrysachs/financensor/commit/9768a6e23804ab86a16ff39a7f6fa272fcf37726))

# [0.8.0](https://github.com/henrysachs/financensor/compare/v0.7.0...v0.8.0) (2026-05-04)


### Features

* add single purchase row editing ([02672a7](https://github.com/henrysachs/financensor/commit/02672a787d7a6dcbe580bd019dad5c6b78aabed0))

# [0.7.0](https://github.com/henrysachs/financensor/compare/v0.6.0...v0.7.0) (2026-05-04)


### Features

* unify purchase draft editing ([af2a2ad](https://github.com/henrysachs/financensor/commit/af2a2ad55873a808d11e82dab4b3883f9de11972))

# [0.6.0](https://github.com/henrysachs/financensor/compare/v0.5.0...v0.6.0) (2026-05-04)


### Features

* improve purchases bulk edit UX ([31e6f2d](https://github.com/henrysachs/financensor/commit/31e6f2d219c8e701b0dc7c6953a1de800b79bcda))

# [0.5.0](https://github.com/henrysachs/financensor/compare/v0.4.0...v0.5.0) (2026-05-04)


### Bug Fixes

* fail ghost merges on partial reassignment errors ([9b828b8](https://github.com/henrysachs/financensor/commit/9b828b85f862df408b87bd289144487723773e4e))
* pass immutable sqlite path to datasette ([95dec5a](https://github.com/henrysachs/financensor/commit/95dec5a5b41917c3e94469f92d4e4891c90e6846))
* use datasette subdomain for sqlite viewer ([a72a66d](https://github.com/henrysachs/financensor/commit/a72a66dc638201215c6e842a7d0ecd903ff1e15f))


### Features

* add protected datasette sqlite viewer ([6342f7a](https://github.com/henrysachs/financensor/commit/6342f7a6a123915124be79898a3c1611549a01d7))

# [0.4.0](https://github.com/henrysachs/financensor/compare/v0.3.0...v0.4.0) (2026-05-03)


### Features

* bulk category assignment for selected purchases ([61203de](https://github.com/henrysachs/financensor/commit/61203de3f6a7c157bec923aeb83d6fe4825fcf2d))

# [0.3.0](https://github.com/henrysachs/financensor/compare/v0.2.3...v0.3.0) (2026-05-03)


### Features

* error toasts, error boundaries, skeleton loading, RFC 9457 parsing ([9c9397e](https://github.com/henrysachs/financensor/commit/9c9397e08d709b624d522fd9deadd336dd4fe913))
* search/sort for purchases, chip-style bulk controls in add form ([25955b6](https://github.com/henrysachs/financensor/commit/25955b61cd53c31d866666bf8e697c33bcdef799))

## [0.2.3](https://github.com/henrysachs/financensor/compare/v0.2.2...v0.2.3) (2026-05-03)


### Bug Fixes

* move auth debug logs to settings drawer, fix pie chart label overflow ([c615c23](https://github.com/henrysachs/financensor/commit/c615c236a5d892ec0504ac4d6b0f16514cce71a9))

## [0.2.2](https://github.com/henrysachs/financensor/compare/v0.2.1...v0.2.2) (2026-05-03)


### Bug Fixes

* redirect to dashboard on / if already authenticated ([29ddb3a](https://github.com/henrysachs/financensor/commit/29ddb3af3aa08b304782b7af4245ae17a618a123))

## [0.2.1](https://github.com/henrysachs/financensor/compare/v0.2.0...v0.2.1) (2026-05-03)


### Bug Fixes

* persist auth debug logs to localStorage for PWA debugging ([6b9f2e9](https://github.com/henrysachs/financensor/commit/6b9f2e989fe78b29a935fbb5fa28158bec13ab96))

# [0.2.0](https://github.com/henrysachs/financensor/compare/v0.1.0...v0.2.0) (2026-05-03)


### Bug Fixes

* categories ([0cb4ae0](https://github.com/henrysachs/financensor/commit/0cb4ae09d92591c6d0249f6e079020d0f2615b74))


### Features

* resilient auth guard — only clear token on 401, not network errors ([6fc3478](https://github.com/henrysachs/financensor/commit/6fc3478ef6c31dbcc2207efbb52c998573fd1780))

# [0.1.0](https://github.com/henrysachs/financensor/compare/v0.0.3...v0.1.0) (2026-05-03)


### Features

* add group api keys and member nicknames ([5e17217](https://github.com/henrysachs/financensor/commit/5e17217ceff3083de69814354fdacf0c936e41fd))

## [0.0.3](https://github.com/henrysachs/financensor/compare/v0.0.2...v0.0.3) (2026-05-03)


### Bug Fixes

* guard deploy image tag against app version drift ([1cbfa8b](https://github.com/henrysachs/financensor/commit/1cbfa8bf115a3b497063cb1af42f5b0ec619af17))
