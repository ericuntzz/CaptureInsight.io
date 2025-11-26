# 🧪 COMPREHENSIVE TESTING CHECKLIST
## CaptureInsight Insights System - Phases 1-7

---

## 📋 Test Status Legend
- ✅ **PASS** - Feature works as expected
- ❌ **FAIL** - Feature broken or not working
- ⚠️ **PARTIAL** - Works but has issues
- 🔄 **TESTING** - Currently being tested
- ⏸️ **SKIP** - Not applicable or blocked

---

## PHASE 1: Tag System Foundation

### Test 1.1: Tag Creation from Capture Toolbar
**Location:** FloatingCaptureToolbar → Tags Button

**Steps:**
1. Open the application (Capture view)
2. Click "Capture Region" button
3. Make a capture (click anywhere to simulate)
4. Verify "Tags (Required)" button appears in toolbar
5. Click the Tags button
6. Verify TagsPopup opens
7. Click "+ Add Tag" button
8. Enter tag name (e.g., "Test Tag")
9. Select a color
10. Click "Create Tag"

**Expected Results:**
- [ ] Tags button appears after capture
- [ ] TagsPopup opens with available tags list
- [ ] Tag creation dialog appears
- [ ] New tag is created and appears in available tags
- [ ] New tag is automatically selected
- [ ] Success toast appears

**Status:** 🔄

---

### Test 1.2: Tag Color Auto-Assignment
**Location:** TagsPopup → Create Tag

**Steps:**
1. Create multiple tags without manually selecting colors
2. Observe colors assigned to each tag

**Expected Results:**
- [ ] Colors cycle through TAG_COLORS array
- [ ] Each new tag gets a different color
- [ ] Colors wrap around after all colors used

**Status:** 🔄

---

### Test 1.3: Tag Name Validation
**Location:** TagsPopup → Create Tag

**Steps:**
1. Try creating a tag with empty name
2. Try creating a tag with 1 character
3. Try creating a tag with 31+ characters
4. Try creating a duplicate tag name (same case)
5. Try creating a duplicate tag name (different case)
6. Create a valid tag (2-30 characters, unique)

**Expected Results:**
- [ ] Empty name shows error
- [ ] Single character shows error
- [ ] 31+ characters shows error
- [ ] Duplicate name (same case) shows error
- [ ] Duplicate name (different case) shows error
- [ ] Valid tag is created successfully

**Status:** 🔄

---

### Test 1.4: Tag Selection in Capture Flow
**Location:** FloatingCaptureToolbar → TagsPopup

**Steps:**
1. Make a capture
2. Open Tags popup
3. Click on a tag to select it
4. Click on another tag to select multiple
5. Click on selected tag to deselect
6. Close popup without saving
7. Reopen popup
8. Verify selections persist

**Expected Results:**
- [ ] Clicking tag selects it (visual indicator)
- [ ] Multiple tags can be selected
- [ ] Clicking selected tag deselects it
- [ ] Selected tags shown with checkmark/highlight
- [ ] Selections persist while popup is open

**Status:** 🔄

---

## PHASE 2: Data Capture with Required Tags

### Test 2.1: Tags Required for Capture
**Location:** FloatingCaptureToolbar → Capture Data

**Steps:**
1. Make a capture
2. Don't select any tags
3. Try to click "Capture Data" button

**Expected Results:**
- [ ] Error message appears: "Please select at least one tag"
- [ ] Capture is not saved
- [ ] Tags popup highlights/pulses (if implemented)

**Status:** 🔄

---

### Test 2.2: Tags Popup Appearance
**Location:** FloatingCaptureToolbar

**Steps:**
1. Make a capture
2. Verify Tags button appears
3. Verify it has "Required" indicator
4. Verify pulse glow animation (first time)

**Expected Results:**
- [ ] Tags button visible after capture
- [ ] Button shows "Required" badge/indicator
- [ ] Pulse animation plays on first appearance
- [ ] Animation stops after 10 seconds or click

**Status:** 🔄

---

### Test 2.3: Tag Association with Data Capture
**Location:** End-to-end capture flow

**Steps:**
1. Make a capture
2. Select tags: ["Marketing", "Q4"]
3. Set destination (Save To)
4. Click "Capture Data"
5. Navigate to Data view
6. Find the captured data
7. Verify tags are associated

**Expected Results:**
- [ ] Capture is saved
- [ ] Tags are associated with the data sheet
- [ ] Tags visible in data view
- [ ] Can filter data by these tags (future)

**Status:** 🔄

---

## PHASE 3: Insights Page Features

### Test 3.1: Navigate to Insights View
**Location:** Left Sidebar → Insights Button

**Steps:**
1. Click "Insights" button in left sidebar
2. Verify Insights view opens to the right of sidebar

**Expected Results:**
- [ ] Insights view opens (doesn't open as separate page)
- [ ] Left sidebar remains visible
- [ ] Insights button highlighted in sidebar
- [ ] Main content area shows InsightsView component

**Status:** 🔄

---

### Test 3.2: View Style Toggling (Row vs Kanban)
**Location:** InsightsView → View Style Buttons

**Steps:**
1. Open Insights view
2. Verify current view style (default: Row)
3. Click Kanban view button
4. Click back to Row view

**Expected Results:**
- [ ] Default view is Row (list layout)
- [ ] Clicking Kanban switches to column layout
- [ ] Insights organized by status columns (Open/Closed)
- [ ] Clicking Row switches back to list layout
- [ ] View preference persists during session

**Status:** 🔄

---

### Test 3.3: Manual Insight Creation
**Location:** InsightsView → "+ Create Insight" Button

**Steps:**
1. Open Insights view
2. Click "+ Create Insight" button
3. Fill in form:
   - Title: "Test Insight"
   - Summary: "This is a test insight for validation"
   - Tags: Select at least one
   - Status: Open
   - Priority: Medium
4. Click "Create Insight"

**Expected Results:**
- [ ] ManualInsightDialog opens
- [ ] All form fields are editable
- [ ] Tags can be selected
- [ ] Status dropdown works
- [ ] Priority dropdown works
- [ ] Create button saves insight
- [ ] New insight appears in InsightsView
- [ ] Success toast appears

**Status:** 🔄

---

### Test 3.4: Source Linking - Data Sheets
**Location:** ManualInsightDialog → Sources Tab

**Steps:**
1. Create new insight
2. Click "Sources" tab
3. Click "Data Sheets" tab
4. Select a data sheet from the list
5. Verify it appears in "Selected Sources"
6. Click remove icon on selected source
7. Save insight

**Expected Results:**
- [ ] Sources tab shows three subtabs (Data Sheets, Change Logs, AI Chats)
- [ ] Data Sheets tab lists available sheets
- [ ] Clicking sheet adds it to selected sources
- [ ] Selected sources display correctly
- [ ] Remove button works
- [ ] Sources are saved with insight

**Status:** 🔄

---

### Test 3.5: Status Transitions
**Location:** InsightsView → Insight Card

**Steps:**
1. Find an insight with "Open" status
2. Note orange status indicator
3. Click status button to change to "Closed"
4. Verify green checkmark appears
5. If in Kanban view, verify card moves to Closed column

**Expected Results:**
- [ ] Open insights show orange dot
- [ ] Closed insights show green checkmark
- [ ] Status can be toggled
- [ ] Kanban view moves cards between columns
- [ ] Status change persists

**Status:** 🔄

---

### Test 3.6: Comments System (Basic)
**Location:** InsightDetailView (if implemented) or ManualInsightDialog

**Steps:**
1. Open an insight
2. Find comment section
3. Type a comment: "This is a test comment"
4. Click "Add Comment"
5. Verify comment appears
6. Try replying to the comment (if threading enabled)

**Expected Results:**
- [ ] Comment input field visible
- [ ] Typing works
- [ ] Submit button adds comment
- [ ] Comment appears in thread
- [ ] Timestamp displayed
- [ ] Author name displayed
- [ ] Threading UI shows nested comments (if implemented)

**Status:** 🔄

---

## PHASE 4: Tag System Core (tagUtils)

### Test 4.1: getNextTagColor Function
**Location:** Developer Console Test

**Steps:**
1. Open browser DevTools console
2. Import and test the function:
```javascript
import { getNextTagColor } from './utils/tagUtils';
const existingTags = [
  { color: 'blue' },
  { color: 'green' },
  { color: 'red' }
];
console.log(getNextTagColor(existingTags)); // Should return next color
```

**Expected Results:**
- [ ] Function returns correct next color
- [ ] Colors cycle through TAG_COLORS array
- [ ] Index calculation correct: `existingTags.length % TAG_COLORS.length`

**Status:** 🔄

---

### Test 4.2: validateTagName Function
**Location:** Developer Console Test

**Steps:**
Test with various inputs:
```javascript
import { validateTagName } from './utils/tagUtils';
console.log(validateTagName('', [])); // Empty
console.log(validateTagName('a', [])); // Too short
console.log(validateTagName('ThisIsAReallyLongTagNameThatExceeds', [])); // Too long
console.log(validateTagName('Valid', [])); // Valid
console.log(validateTagName('marketing', [{ name: 'Marketing' }])); // Duplicate
```

**Expected Results:**
- [ ] Empty name returns error message
- [ ] Short name (<2 chars) returns error
- [ ] Long name (>30 chars) returns error
- [ ] Duplicate name (case-insensitive) returns error
- [ ] Valid name returns null

**Status:** 🔄

---

### Test 4.3: getTagUsageStats Function
**Location:** TagManagementView or Developer Test

**Steps:**
1. Create a tag
2. Use it on multiple entities (insights, data sheets, etc.)
3. Call getTagUsageStats for this tag
4. Verify counts

**Expected Results:**
- [ ] Returns object with counts per entity type
- [ ] insights: count of insights with this tag
- [ ] dataSheets: count of data sheets with this tag
- [ ] chatMessages: count of chat messages with this tag
- [ ] changeLogs: count of change logs with this tag
- [ ] total: sum of all counts

**Status:** 🔄

---

### Test 4.4: cascadeDeleteTag Function
**Location:** TagManagementView → Delete Tag

**Steps:**
1. Create a tag
2. Use it on multiple entities
3. Try to delete the tag
4. Confirm deletion in dialog
5. Verify tag removed from all entities

**Expected Results:**
- [ ] Deletion warning shows usage stats
- [ ] Confirmation dialog appears
- [ ] After confirmation, tag deleted
- [ ] Tag removed from all associated entities
- [ ] No orphaned tag_associations
- [ ] Success message appears

**Status:** 🔄

---

## PHASE 5: Unified Tag Architecture

### Test 5.1: TagManagementView Access
**Location:** Should be accessible from somewhere (check implementation)

**Steps:**
1. Find how to access TagManagementView
2. Open the view
3. Verify tag list displays

**Expected Results:**
- [ ] TagManagementView is accessible
- [ ] All tags for current space displayed
- [ ] Tag count shown
- [ ] Usage stats visible
- [ ] Edit and delete buttons available

**Status:** 🔄

---

### Test 5.2: TagBadge Component with Menu
**Location:** Any view showing tags (InsightsView, Data view, etc.)

**Steps:**
1. Find a tag badge
2. Click on it
3. Verify dropdown menu appears
4. Try menu options (if any)

**Expected Results:**
- [ ] Tag badge displays correctly
- [ ] Shows tag name and color
- [ ] Clicking opens menu
- [ ] Menu shows options (View usage, Edit, Delete, etc.)
- [ ] Menu options work

**Status:** 🔄

---

### Test 5.3: TagSelector Component
**Location:** ManualInsightDialog, FloatingCaptureToolbar

**Steps:**
1. Open any component using TagSelector
2. Verify available tags displayed
3. Select multiple tags
4. Create a new tag inline
5. Verify new tag appears and is selected

**Expected Results:**
- [ ] TagSelector displays available tags
- [ ] Multiple selection works
- [ ] Selected tags highlighted
- [ ] "+ Add Tag" button works
- [ ] New tag creation dialog appears
- [ ] New tag added to selection
- [ ] Validation works (duplicate names, etc.)

**Status:** 🔄

---

### Test 5.4: UniversalTagSearch
**Location:** Should be accessible from main navigation or search bar

**Steps:**
1. Create test data with same tag:
   - Insight with tag "Q4"
   - Data sheet with tag "Q4"
   - Chat message with tag "Q4" (if implemented)
2. Use UniversalTagSearch
3. Search for "Q4"
4. Verify results

**Expected Results:**
- [ ] Search input visible and functional
- [ ] Search finds all entities with matching tag
- [ ] Results grouped by entity type
- [ ] Each result shows title/name
- [ ] Clicking result navigates to entity
- [ ] Empty state shown if no results

**Status:** 🔄

---

## PHASE 6: Navigation & User Flow

### Test 6.1: Left Sidebar Navigation
**Location:** Left sidebar (always visible)

**Steps:**
1. Open application
2. Verify left sidebar visible
3. Verify navigation items present:
   - Space Switcher dropdown (top)
   - AI Assistant
   - Project Files (Data)
   - Change Logs
   - Insights

**Expected Results:**
- [ ] Left sidebar always visible
- [ ] Space Switcher dropdown at top
- [ ] All navigation items present
- [ ] Icons visible for each item
- [ ] Current view highlighted

**Status:** 🔄

---

### Test 6.2: View Switching - All Views Open to Right
**Location:** Left Sidebar → Each navigation button

**Steps:**
1. Click "AI Assistant" → Verify opens to right of sidebar
2. Click "Project Files (Data)" → Verify opens to right
3. Click "Change Logs" → Verify opens to right
4. Click "Insights" → Verify opens to right

**Expected Results:**
- [ ] All views open in main content area (right of sidebar)
- [ ] Sidebar remains visible for all views
- [ ] NO full-page takeovers
- [ ] Smooth transitions between views
- [ ] Active view button highlighted in sidebar

**Status:** 🔄

---

### Test 6.3: No Top Navigation Bar
**Location:** Entire application

**Steps:**
1. Check top of application
2. Verify NO top navigation bar exists
3. Verify all navigation is in left sidebar

**Expected Results:**
- [ ] No top navigation bar visible
- [ ] Logo (if any) in left sidebar
- [ ] Space name in left sidebar dropdown
- [ ] All navigation consolidated in left sidebar

**Status:** 🔄

---

### Test 6.4: Space Switcher Dropdown
**Location:** Left Sidebar → Top dropdown

**Steps:**
1. Find Space Switcher dropdown at top of sidebar
2. Click to open dropdown
3. View list of available spaces
4. Select a different space
5. Verify all data updates to show selected space's data

**Expected Results:**
- [ ] Dropdown displays current space name
- [ ] Clicking opens list of spaces
- [ ] All spaces visible in dropdown
- [ ] Selecting space switches context
- [ ] All views update to show selected space's data
- [ ] Tags, insights, data filtered by space

**Status:** 🔄

---

## PHASE 7: Deep Linking & URL Routing

### Test 7.1: URL Updates on View Changes
**Location:** Browser address bar

**Steps:**
1. Start at capture view (/)
2. Click "Data" → Check URL changes to /data
3. Click "Change Logs" → Check URL changes to /changelogs
4. Click "Insights" → Check URL changes to /insights

**Expected Results:**
- [ ] URL updates when switching views
- [ ] Capture view: /
- [ ] Data view: /data
- [ ] Change Logs: /changelogs
- [ ] Insights: /insights
- [ ] URL changes without page reload

**Status:** 🔄

---

### Test 7.2: Deep Links Work (Direct URL Access)
**Location:** Browser address bar

**Steps:**
1. Copy URL of an insight: `/insights/insight-123`
2. Open new browser tab
3. Paste and navigate to that URL
4. Verify correct view and item loads

**Expected Results:**
- [ ] Direct URL access works
- [ ] Correct view loads
- [ ] Correct item displayed
- [ ] No errors or redirects
- [ ] Can share URLs with others

**Status:** 🔄

---

### Test 7.3: Browser Back/Forward Buttons
**Location:** Browser navigation

**Steps:**
1. Navigate: Capture → Data → Insights → Data
2. Click browser back button
3. Verify goes back to Insights
4. Click back again → Data
5. Click back again → Capture
6. Click forward button → Data
7. Click forward again → Insights

**Expected Results:**
- [ ] Back button works correctly
- [ ] Forward button works correctly
- [ ] View state matches URL
- [ ] No page reloads
- [ ] History preserved correctly

**Status:** 🔄

---

### Test 7.4: Route Helpers (buildRoute functions)
**Location:** Developer Console Test

**Steps:**
Test route builder functions:
```javascript
import { buildRoute } from './routes';
console.log(buildRoute.capture()); // Should be '/'
console.log(buildRoute.insights()); // Should be '/insights'
console.log(buildRoute.insightDetail('insight-123')); // Should be '/insights/insight-123'
```

**Expected Results:**
- [ ] buildRoute.capture() returns '/'
- [ ] buildRoute.insights() returns '/insights'
- [ ] buildRoute.insightDetail(id) returns '/insights/:id'
- [ ] All route builders work correctly

**Status:** 🔄

---

## INTEGRATION TESTS

### Integration Test 1: End-to-End Insight Creation from Capture
**Scenario:** User captures data, tags it, analyzes with AI, creates insight

**Steps:**
1. Make a screen capture
2. Add tags: ["Revenue", "Q4"]
3. Save to a folder
4. Open AI Assistant
5. Ask question about the data
6. Tag the AI conversation
7. Create insight from tagged conversation
8. Link the data capture as a source
9. Add a comment to the insight
10. Verify insight appears in Insights view
11. Verify clicking insight shows all linked sources

**Expected Results:**
- [ ] Complete flow works without errors
- [ ] Tags carry through all steps
- [ ] Sources link correctly
- [ ] Comments save correctly
- [ ] Everything searchable by tags

**Status:** 🔄

---

### Integration Test 2: Multi-View Navigation Flow
**Scenario:** User navigates through all views, data persists

**Steps:**
1. Start in Capture view
2. Make a capture with tags
3. Switch to Data view → Verify capture appears
4. Switch to Insights view
5. Create an insight
6. Switch to Change Logs view
7. Switch back to Insights → Verify insight still there
8. Use browser back button through history
9. Refresh page
10. Verify last view restored

**Expected Results:**
- [ ] All views accessible
- [ ] Data persists across view changes
- [ ] No data loss
- [ ] Browser history works
- [ ] Page refresh preserves state (where applicable)

**Status:** 🔄

---

### Integration Test 3: Tag Ecosystem Test
**Scenario:** Create tag, use across all entity types, search, delete

**Steps:**
1. Create tag "TestTag-Delete"
2. Apply to data capture
3. Apply to insight
4. Apply to AI chat message
5. Use UniversalTagSearch to find all
6. Verify all 3 entities appear in results
7. Delete the tag
8. Verify removed from all entities
9. Search again → no results

**Expected Results:**
- [ ] Tag applies to all entity types
- [ ] Search finds all tagged items
- [ ] Cascade delete removes from all entities
- [ ] No orphaned associations

**Status:** 🔄

---

## EDGE CASES & ERROR HANDLING

### Edge Case 1: Empty States
**Locations:** All views

**Steps:**
1. Create new space with no data
2. Check each view:
   - Data view (no captures)
   - Insights view (no insights)
   - Change Logs (no logs)
   - Tag search (no tags)

**Expected Results:**
- [ ] Empty states show helpful messages
- [ ] Call-to-action buttons present
- [ ] No errors or blank screens
- [ ] Guidance on how to add first item

**Status:** 🔄

---

### Edge Case 2: Very Long Tag Names
**Location:** Tag creation

**Steps:**
1. Try creating tag with exactly 30 characters (max)
2. Try 31 characters (should fail)
3. Verify validation

**Expected Results:**
- [ ] 30 characters accepted
- [ ] 31+ characters rejected
- [ ] Clear error message
- [ ] Form doesn't submit

**Status:** 🔄

---

### Edge Case 3: Special Characters in Tags
**Location:** Tag creation

**Steps:**
1. Try tags with: emoji 🔥, symbols #$%, numbers 123
2. Verify which are allowed

**Expected Results:**
- [ ] Define what's allowed (alphanumeric + spaces?)
- [ ] Validation prevents invalid characters
- [ ] OR all characters allowed (design decision)

**Status:** 🔄

---

### Edge Case 4: Rapid View Switching
**Location:** Left sidebar navigation

**Steps:**
1. Rapidly click between views:
   Data → Insights → Data → Insights (repeat 10x fast)

**Expected Results:**
- [ ] No errors
- [ ] Views load correctly
- [ ] No race conditions
- [ ] No memory leaks
- [ ] Smooth performance

**Status:** 🔄

---

### Edge Case 5: Network Errors (Mock)
**Location:** Any API call

**Steps:**
1. Simulate network error (disconnect WiFi or use DevTools)
2. Try creating insight
3. Try loading insights

**Expected Results:**
- [ ] Error message displayed
- [ ] Retry button available
- [ ] Form data not lost
- [ ] Graceful degradation
- [ ] Clear user feedback

**Status:** 🔄

---

## PERFORMANCE TESTS

### Performance Test 1: Large Dataset
**Scenario:** 100+ insights, 50+ tags

**Steps:**
1. Create 100 mock insights
2. Assign multiple tags to each
3. Load Insights view
4. Switch between Row and Kanban views
5. Use filters
6. Search tags

**Expected Results:**
- [ ] Page loads in <2 seconds
- [ ] View switching smooth (<500ms)
- [ ] No lag in interactions
- [ ] Search results <500ms
- [ ] Consider pagination/virtualization if slow

**Status:** 🔄

---

### Performance Test 2: Memory Leaks
**Scenario:** Extended use session

**Steps:**
1. Open DevTools → Performance Monitor
2. Switch between views 50+ times
3. Create and delete tags 20+ times
4. Monitor memory usage

**Expected Results:**
- [ ] Memory usage stable
- [ ] No continuous growth
- [ ] Garbage collection working
- [ ] No detached DOM nodes

**Status:** 🔄

---

## ACCESSIBILITY TESTS

### Accessibility Test 1: Keyboard Navigation
**Location:** All views

**Steps:**
1. Try navigating with Tab key only
2. Try using Enter to activate buttons
3. Try using Escape to close dialogs

**Expected Results:**
- [ ] All interactive elements reachable via Tab
- [ ] Focus indicators visible
- [ ] Enter activates buttons
- [ ] Escape closes modals/dialogs
- [ ] Logical tab order

**Status:** 🔄

---

### Accessibility Test 2: Screen Reader Compatibility
**Location:** All views

**Steps:**
1. Use screen reader (NVDA, JAWS, VoiceOver)
2. Navigate through application
3. Verify all content announced

**Expected Results:**
- [ ] All text content readable
- [ ] Buttons have descriptive labels
- [ ] Form fields have labels
- [ ] Images have alt text
- [ ] Semantic HTML used

**Status:** 🔄

---

## CROSS-BROWSER TESTING

### Browser Test Matrix
Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Test on each browser:**
1. Core navigation works
2. Insights view renders correctly
3. Modals/dialogs open and close
4. Tags functionality works
5. No console errors

---

## MOBILE RESPONSIVENESS

### Mobile Test 1: Viewport Sizes
**Steps:**
1. Test on mobile viewport (375px width)
2. Test on tablet viewport (768px width)
3. Check left sidebar behavior
4. Check if views adapt

**Expected Results:**
- [ ] Left sidebar collapses or adapts on mobile
- [ ] Content remains accessible
- [ ] Touch targets large enough (44x44px min)
- [ ] No horizontal scrolling
- [ ] Readable font sizes

**Status:** 🔄

---

## SUMMARY REPORT

**Total Tests:** ~60+ test scenarios
**Passed:** ___
**Failed:** ___
**Partial:** ___
**Skipped:** ___

**Critical Issues Found:**
1. 
2. 
3. 

**Minor Issues Found:**
1. 
2. 
3. 

**Recommendations:**
1. 
2. 
3. 

**Next Steps:**
1. Fix critical issues
2. Address minor issues
3. Proceed to Phase 8 (Supabase integration)
4. Implement missing features from TODO list

---

## Notes
- This checklist covers Phases 1-7 of the Insights System Implementation
- Phase 8+ (Supabase integration) requires separate testing
- All tests assume mock data is in place
- Update test status as you go: 🔄 → ✅ or ❌
- Document any unexpected behavior in Notes section below

---

## Testing Notes
(Add notes here as you test)

