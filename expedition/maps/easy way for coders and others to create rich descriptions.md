---
id: 76d33e78-22d9-4dd9-a9b3-2e419674395f
title: easy way for coders and others to create rich descriptions
parentId: d1ed7c14-b07d-4d2a-8b5b-65e119a362ee
childrenIds: []
calculatedMetrics:
  readinessLevel: 3
draft: false
type: map
setMetrics:
  readinessLevel: 3
---

# Markdown Example: Real-World Usage

## Introduction

Markdown is a lightweight markup language that makes it easy to format text. Below is an example showcasing all basic Markdown elements.

that

---

## Text Formatting

This is **bold text**, and this is _italic text_. You can also **_combine both_**.
Here is some ~~strikethrough text~~.

## Code

```typescript
export const RlPill = ({ level, auto }: { level?: number; auto?: boolean }) => (
  <div
    style={{
      ...styles.readinessLevelPill,
      backgroundColor:
        level != null
          ? styles.readinessLevelColors[
              level as keyof typeof styles.readinessLevelColors
            ]
          : "var(--background-secondary)",
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}
  >
    {level != null ? formatReadinessLevel(level) : "auto"}
    {auto && (
      <Tooltip title="automatically calculated from children">
        <AutoMode sx={{ fontSize: 14, opacity: 0.7 }} />
      </Tooltip>
    )}
  </div>
);
```

## Lists

### Unordered List

This is what an unordered list looks like.

- Apples
- Bananas
- Cherries

### Ordered List

1. First item
2. Second item
3. Third item

### Nested List

- Fruits:
  - Apple
  - Banana
- Vegetables:
  - Carrot
  - Spinach

## Blockquotes

> "This is a quote from someone famous."

## Links

[Visit OpenAI](https://openai.com)

## Images

![Example Image](https://fastly.picsum.photos/id/18/200/300.jpg?hmac=ey-vd9wCRyYWPf6nwCk_ciMCPRLrWvI7O5Z1Hfg2Cf0)

## Tables

| Name    | Age | Profession |
| ------- | --: | ---------- |
| Alice   |  25 | Engineer   |
| Bob     |  30 | Designer   |
| Charlie |  35 | Writer     |

## Horizontal Rule

---

## Inline Code

Use `console.log("Hello, world!");` to print a message in JavaScript.
