# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.0] - 2025-06-23

### Added

- **Section-focused-mode feature**: New zoom functionality for hierarchical tables
  - Added focus stack state management per section (persisted in session storage)
  - Added zoom-in button (ZoomOutMap icon) to focus on selected sub-nodes
  - Added zoom-out button (ZoomInMap icon) to return to parent view
  - Focus buttons always visible with appropriate graying when unavailable
  - Helpful tooltips guide users on activation requirements
  - HierarchicalTable now renders only focused subtree when zoomed in
  - Focus stack allows drilling down through complex hierarchies

### Changed

- **Component Architecture Refactoring**: Major reorganization for better maintainability

  - Created `AppHeaderBar` component from App header section (~80 lines reduced)
  - Created `Section` component encapsulating SectionBar + content (~200 lines reduced)
  - Created `SectionBar` component for section headers (~150 lines reduced)
  - Moved section-specific state into appropriate components
  - Improved state localization (hover effects, draft toggles)
  - Reduced App.tsx complexity by ~450+ lines total

- **State Management Improvements**:

  - Moved global draft toggle to app header with Material UI Switch
  - Localized hover state to SectionBar component
  - Simplified prop drilling by removing unnecessary state passing
  - Added proper component composition patterns

- **UI/UX Enhancements**:
  - Improved visual hierarchy with flush-right button alignment
  - Used proper four-arrows style zoom icons (ZoomOutMap/ZoomInMap)
  - Enhanced tooltips with actionable guidance
  - Consistent button styling and hover effects
  - Better accessibility with proper aria-labels and focus management

### Technical Improvements

- **Code Organization**:

  - Better separation of concerns across components
  - Reduced monolithic App component complexity
  - Improved component reusability and testability
  - Enhanced type safety with proper prop interfaces

- **Performance Optimizations**:
  - Localized state updates to reduce unnecessary re-renders
  - Optimized component composition for better React performance
  - Efficient focus stack management with session storage persistence

### Developer Experience

- **Component Structure**: Clear component hierarchy with well-defined responsibilities
- **Maintainability**: Easier to modify and extend individual features
- **Debugging**: Better component isolation for troubleshooting
- **Code Quality**: Reduced duplication and improved readability

---

_This release represents a significant architectural improvement while adding powerful new navigation capabilities for complex hierarchical data structures._
