# Readiness Levels

## Overview

| Level | Name              | Summary                                   | AirBnB Analogy                  |
| ----- | ----------------- | ----------------------------------------- | ------------------------------- |
| RL0   | Plan              | Initial planning and tech stack selection | N/A                             |
| RL1   | Spike             | Core technical risks proven feasible      | Knock on door, no answer        |
| RL2   | Prototype         | Basic demo-able functionality             | Basic shelter                   |
| RL3   | Alpha             | Core functionality works, rough edges     | 20min late check-in             |
| RL4   | Beta              | Feature complete, needs polish            | Basic expectations met          |
| RL5   | Industry-Standard | Solid, reliable product                   | Smooth, professional experience |
| RL6   | Industry-Leading  | Exceptional quality and polish            | Welcome gift, extra touches     |
| RL7   | World-Leading     | Delightfully perfect experience           | Personal concierge service      |
| RL8   | World-Changing    | Revolutionary impact                      | Celebrity welcome committee     |
| RL9   | Epic              | Once-in-a-lifetime experience             | Space trip with Elon            |

## Detailed Descriptions

### RL0: Plan

- **Status**: Something written
- **Description**: Top-level goal has been set, and tech stack has been selected; ready to start building
- **Testing**: N/A
- **DevOps**: N/A
- **Key Requirement**: Document target Readiness-Level(s), certification requirements, and any other target-delivery requirements that significantly impact budget

### RL1: Spike

- **Status**: An Experiment - at least one non-trivial thing proven to work
- **Description**: At least one non-trivial aspect is working; integrations-related risks have been largely assessed; proof of possibility (or impossibility)
- **UX**: Barely working
- **Testing**: Framework working but empty, 0% coverage
- **AirBnB Analogy**: 1-star - knock on the door, no-one there, fail

### RL2: Prototype/POC

- **Status**: Something to see/show
- **Description**: At least one core use-case can be accomplished; may have danger zones; demo should be conducted by an engineer
- **UX**: Demoable
- **Testing**: Good testing drives design; POCs should have a POC of what testing should look like, 20% coverage
- **DevOps**: Dev environment setup

### RL3: Alpha

- **Status**: Something usable
- **Description**: Usable by actual target users, but still has substantial rough edges
- **UX**: Usable
- **Testing**: 50% coverage
- **Reliability**: 99% (2 nines)
- **AirBnB Analogy**: 3-star - they are 20 minutes late
- **DevOps**: Protected main branch, CI: PRs require unit-tests to pass

### RL4: Beta Release Candidate

- **Status**: Mostly usable / Mostly releasable
- **Description**: All planned use-cases and edge-cases have been addressed
- **Testing**: 70% coverage
- **Reliability**: 99.5% (2.5 nines)
- **DevOps**: Staging & Production environments

### RL5: Industry-Standard

- **Status**: Fully Releasable / Fully Usable
- **Description**: Core-Polished, Industry Standard Product
- **UX**: 80% polished
- **Testing**:
  - Unit-Test Coverage: 80% overall, 100% happy-path
  - Basic Q/A: people-scripts for happy paths and select exceptional-paths
  - Scripts tested on devices covering 80%+ of users
  - User-Testing: Internal, private beta
- **Reliability**: 99.9% (3 nines)
- **AirBnB Analogy**: 5-star - smooth, professional experience
- **DevOps**: High-availability production environment

### RL6: Industry-Leading

- **Status**: Something exceptional
- **Description**: Fully-Polished, Industry Leading Product
- **UX**: 90% polished
- **Testing**:
  - Full Q/A coverage
  - Device coverage 95%+
  - Public beta with 10x users
- **Reliability**: 99.95% (3.5 nines)
- **AirBnB Analogy**: 6-star - warm welcome with welcome gift

### RL7: World-Leading

- **Status**: Delightful
- **Description**: Perfect combination of performance, UX, and delight
- **UX**: 95% polished
- **Testing**: Comprehensive
- **Reliability**: 99.99% (4 nines)
- **AirBnB Analogy**: 7-star - personal concierge service, everything customized

### RL8: World-Changing

- **Status**: Revolutionary
- **Description**: Changes how people think about the problem
- **UX**: 100% polished
- **Reliability**: 99.995% (4.5 nines)
- **AirBnB Analogy**: 8-star - welcomed by cheering crowds

### RL9: Epic

- **Status**: Once in a lifetime
- **Description**: Sets a new standard for what's possible
- **Reliability**: 99.999% (5 nines)
- **AirBnB Analogy**: 9-star - "You're going to space with Elon"
