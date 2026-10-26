path = r'C:\Users\Admin\Desktop\App\merosadak\src\components/RoutePlanner.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Section 1 (compact bento) to remove - from the comment through the closing of the conditional
start_marker = "       {/* 5. READY REPORTS IN A SHORT PLACE WITH MORE INFO (COMPACT BENTO DASHBOARD) */}"
end_marker = "{sections.isExpanded('results') && ("

start_idx = content.index(start_marker)
end_idx = content.index(end_marker, start_idx)

# Replace section 1 + the opening of section 2 with just section 2's opening (changed condition)
new_text = "       {deckId === 'results' && hasCalculated && routePlan && (\n          <div\n            id=\"route-results-panel\"\n            key={`route-results-panel-${calcKey}-${routePlan.id}`}\n            className=\"p-3 sm:p-4 space-y-3 animate-fade-in-smooth transition-all duration-500 ease-out max-w-full\"\n         >"

content = content[:start_idx] + new_text + content[end_idx + len(end_marker):]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Replacement done')
