/**
 * Source for the code stage and the compare panels, on the design system's `CodeBlock`: syntax colour,
 * gutter numbers, highlighted lines and a copy button. One file is one block; several files get tabs.
 */

import { useId, useState } from 'react';
import { CodeBlock, type CodeLang, TabPanel, Tabs } from '@/ui';

export interface CodeFile {
  name: string;
  lang: CodeLang;
  code: string;
  highlight?: number[];
}

export interface CodeViewProps {
  files: readonly CodeFile[];
  /** Which file is open at first. */
  initial?: number;
  /** An unnamed single snippet (the compare panels): the block shows its language as the title. */
  bare?: boolean;
  /** Accessible name of the whole block. */
  label?: string;
  /**
   * Wrap long lines (the continuation rows hang under the code) instead of scrolling sideways. For narrow
   * places such as a compare panel, where a line scrolled out of sight is a line that is not read.
   */
  wrap?: boolean;
  className?: string;
}

function Block({
  file,
  bare,
  label,
  wrap,
}: {
  file: CodeFile;
  bare: boolean;
  label?: string;
  wrap: boolean;
}) {
  return (
    <CodeBlock
      code={file.code}
      lang={file.lang}
      filename={bare ? undefined : file.name}
      highlight={file.highlight}
      label={label}
      wrap={wrap}
    />
  );
}

export function CodeView({
  files,
  initial = 0,
  bare = false,
  label,
  wrap = false,
  className,
}: CodeViewProps) {
  const base = useId();
  const [value, setValue] = useState(String(Math.min(Math.max(initial, 0), Math.max(files.length - 1, 0))));
  if (files.length === 0) return null;

  const only = files[0];
  if (files.length === 1 && only) {
    return (
      <div className={className}>
        <Block file={only} bare={bare} label={label} wrap={wrap} />
      </div>
    );
  }

  return (
    <div className={className}>
      <Tabs
        idBase={base}
        aria-label={label ?? 'Source files'}
        items={files.map((f, i) => ({ value: String(i), label: f.name }))}
        value={value}
        onValueChange={setValue}
        size="sm"
      >
        {files.map((f, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the files are a static ordered list
          <TabPanel key={i} value={String(i)}>
            <Block file={f} bare={false} label={label ? `${label}: ${f.name}` : undefined} wrap={wrap} />
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
