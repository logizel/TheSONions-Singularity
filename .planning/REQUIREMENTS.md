# Requirements: TheSONions-Singularity — Hospital Stock Balancer

**Defined:** 2026-10-08
**Core Value:** Administrator knows before it happens who runs out, what wastes, and which transfer or order fixes it.

## v1 Requirements

Requirements for prototype release. Each maps to roadmap phases.

### Data Collection

- [ ] **DATA-01**: Hospital admin can enter current stock per medicine with expiry date
- [ ] **DATA-02**: Hospital admin can enter daily usage count per medicine
- [ ] **DATA-03**: Hospital admin can enter patient load count and emergency share percent
- [ ] **DATA-04**: Network admin can configure transport days between hospitals and supplier lead times
- [ ] **DATA-05**: Hospital admin can bulk-upload 60 days demand history via CSV and export data to Excel

### Forecast

- [x] **FCAST-01**: System forecasts demand per hospital/medicine for next 30 days from weekly pattern (60 days history)
- [x] **FCAST-02**: System reports forecast error (MAPE) against history, target band 3-11%

### Outbreak

- [x] **OUTBK-01**: System flags outbreak when daily demand climbs far above normal range (above +2σ for 2 consecutive days)
- [x] **OUTBK-02**: System switches flagged hospital to recent-rising-trend forecast until demand normalizes

### Stock-out Risk

- [x] **RISK-01**: System computes days-until-stockout (stock ÷ forecast demand) per hospital/medicine
- [x] **RISK-02**: System warns when days-until-stockout is shorter than supplier lead time (e.g. runs out in 10 days, supplier needs 14)

### Waste Risk

- [x] **WASTE-01**: System computes waste units (stock minus realistic demand before expiry, capped at 90 days)
- [x] **WASTE-02**: System warns per hospital/medicine with expiring-unused quantities (e.g. 3,500 units expire unused)

### Moves & Orders

- [x] **MOVE-01**: System suggests transfers from safe-surplus to short hospitals passing all 5 checks (arrives before receiver runs out; enough shelf life on arrival; sender keeps buffer; nothing beyond receiver need; waste-first + nearest sender preferred)
- [x] **MOVE-02**: System recommends emergency supplier order for remainder when transfers cannot cover need

### Priority

- [x] **PRIOR-01**: System scores competing hospitals by patient load, emergency demand, soonness of stock-out, and substitute existence
- [x] **PRIOR-02**: System shows visible ranking with reasons so it can be justified

### Dashboard

- [ ] **UI-01**: Administrator sees inventory, forecast, shortage risk, expiry risk, recommended moves, and priority hospitals on one screen
- [ ] **UI-02**: Administrator can click into any hospital for detail

### Chatbot

- [x] **CHAT-01**: Administrator can ask risk questions (e.g. "Which hospital is most at risk next week?") via small rule-based intent matcher
- [x] **CHAT-02**: Chatbot answers only by quoting precomputed ResultsJSON, never calculates
- [x] **CHAT-03**: System rejects any answer containing a number not present in ResultsJSON

### Access

- [x] **AUTH-01**: Hospital admin has read/write access to own hospital details and read-only access to other hospitals
- [x] **AUTH-02**: Network admin has full read/write access including moves and orders

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Integrations

- **INTG-01**: Pull demand data from hospital EHR systems
- **INTG-02**: Send orders directly to supplier systems

### Mobile

- **MOBL-01**: Administrator can view risks and approve moves from mobile

### Chatbot upgrade

- **CHAT-04**: Swap rule-based matcher for local or remote LLM behind the same quote-only interface and validator

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Patient-level data / PHI | Aggregates only keeps prototype out of HIPAA scope |
| Direct EHR integration | Invasive access, deferred to v2 behind INTG-01 |
| Real supplier ordering | v1 recommends order only, no external ordering calls |
| Mobile app | Web dashboard first for prototype |
| 15-30 day forecast as decision trigger | Error grows with horizon, advisory display only |
| Python ML forecasting | Weekly-pattern statistics suffice for prototype |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| FCAST-01 | Phase 2 | Complete |
| FCAST-02 | Phase 2 | Complete |
| OUTBK-01 | Phase 2 | Complete |
| OUTBK-02 | Phase 2 | Complete |
| RISK-01 | Phase 2 | Complete |
| RISK-02 | Phase 2 | Complete |
| WASTE-01 | Phase 2 | Complete |
| WASTE-02 | Phase 2 | Complete |
| MOVE-01 | Phase 2 | Complete |
| MOVE-02 | Phase 2 | Complete |
| PRIOR-01 | Phase 2 | Complete |
| PRIOR-02 | Phase 2 | Complete |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| CHAT-01 | Phase 3 | Complete |
| CHAT-02 | Phase 3 | Complete |
| CHAT-03 | Phase 3 | Complete |
| AUTH-01 | Phase 3 | Complete |
| AUTH-02 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24 (Phase 1: 5, Phase 2: 12, Phase 3: 5, Phase 4: 2, Phase 5: integration — no new requirements)
- Unmapped: 0

---
*Requirements defined: 2026-10-08*
*Last updated: 2026-10-08 after roadmap creation (traceability mapped)*
