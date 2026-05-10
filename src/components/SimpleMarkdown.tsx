import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/themeContext';

// Tiny inline markdown renderer for legal documents.
// Handles: # H1 / ## H2 / ### H3 / **bold** inline / blank lines / paragraphs.
// No links, no lists, no tables — keep it simple, the legal docs only need this.
export function SimpleMarkdown({ source }: { source: string }) {
  const { colors } = useTheme();
  const lines = source.split('\n');

  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      out.push(<View key={`sp-${i}`} style={styles.spacer} />);
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      out.push(
        <Text key={i} style={[styles.h3, { color: colors.textPrimary }]}>
          {trimmed.slice(4)}
        </Text>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      out.push(
        <Text key={i} style={[styles.h2, { color: colors.textPrimary }]}>
          {trimmed.slice(3)}
        </Text>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      out.push(
        <Text key={i} style={[styles.h1, { color: colors.textPrimary }]}>
          {trimmed.slice(2)}
        </Text>
      );
      i++;
      continue;
    }

    // Group consecutive non-empty, non-heading lines into one paragraph
    const paragraph: string[] = [trimmed];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (!next || next.startsWith('#')) break;
      paragraph.push(next);
      j++;
    }
    out.push(
      <Text key={i} style={[styles.p, { color: colors.textPrimary }]}>
        {renderInline(paragraph.join(' '))}
      </Text>
    );
    i = j;
  }

  return <View>{out}</View>;
}

// Splits a paragraph by **bold** markers and returns mixed Text spans.
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <Text key={`b-${key++}`} style={styles.bold}>
        {match[1]}
      </Text>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 12,
    letterSpacing: 0.3
  },
  h2: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8
  },
  h3: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6
  },
  p: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8
  },
  bold: {
    fontWeight: '700'
  },
  spacer: {
    height: 8
  }
});
