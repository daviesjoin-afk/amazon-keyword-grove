## Summary

<!-- What changed and why? Keep this focused on user or maintainer impact. -->

## Risk / data impact

- [ ] No persisted-data format change
- [ ] No change to manual approval / manual-lock safety boundaries
- [ ] No API key or private business data is added to code, fixtures, logs, or screenshots
- [ ] If any item above is false, the migration/risk is explained below

<!-- Explain compatibility, migrations, or rollback considerations when applicable. -->

## Validation

- [ ] Backend: `python -m compileall -q backend`
- [ ] Backend: `python -m pip check`
- [ ] Backend: `python -m pytest backend/tests -q`
- [ ] Frontend: `pnpm test`
- [ ] Frontend: `pnpm build`
- [ ] New behavior or fixed regression has test coverage

## User-visible changes

<!-- Screenshots or concise before/after notes for UI changes. Use synthetic/demo data only. -->

## Rollback

<!-- How can this change be safely reverted if needed? -->
