import React, { useEffect, useRef, useState, useCallback } from 'react';

// Converts ASCII alphanumeric text to Unicode Bold characters so Facebook/Instagram render bold
export function toUnicodeBold(text: string): string {
  return text.split('').map((char) => {
    const code = char.charCodeAt(0);
    // A-Z: 0x1D400
    if (code >= 65 && code <= 90) {
      return String.fromCodePoint(0x1D400 + (code - 65));
    }
    // a-z: 0x1D41A
    if (code >= 97 && code <= 122) {
      return String.fromCodePoint(0x1D41A + (code - 97));
    }
    // 0-9: 0x1D7CE
    if (code >= 48 && code <= 57) {
      return String.fromCodePoint(0x1D7CE + (code - 48));
    }
    return char;
  }).join('');
}

// Convert HTML DOM from contentEditable to plain social text preserving Unicode bold
export function domToSocialPlainText(node: Node): string {
  let result = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent || '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const styleWeight = el.style.fontWeight;
      const isBold =
        tag === 'b' ||
        tag === 'strong' ||
        styleWeight === 'bold' ||
        styleWeight === '700' ||
        styleWeight === '800' ||
        styleWeight === '900';

      let inner = domToSocialPlainText(el);
      if (isBold) {
        inner = toUnicodeBold(inner);
      }

      if (tag === 'div' || tag === 'p') {
        result += (result.length > 0 && !result.endsWith('\n') ? '\n' : '') + inner + '\n';
      } else if (tag === 'br') {
        result += '\n';
      } else {
        result += inner;
      }
    }
  });
  return result;
}

interface RichPostEditorProps {
  initialHtml: string;
  onChange: (socialPlainText: string, rawHtml: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onCopyFromOther?: () => void;
  copyFromOtherLabel?: string;
  minHeight?: string;
  height?: string;
}

export const RichPostEditor: React.FC<RichPostEditorProps> = ({
  initialHtml,
  onChange,
  disabled = false,
  placeholder = 'Write or paste post content here...',
  onCopyFromOther,
  copyFromOtherLabel,
  minHeight = '230px',
  height,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const isInternalUpdate = useRef(false);

  const updateContent = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const socialText = domToSocialPlainText(editorRef.current).trim();
    setCharCount(editorRef.current.innerText.trim().length);
    isInternalUpdate.current = true;
    onChange(socialText, html);
  }, [onChange]);

  // Sync initial / external HTML changes into contentEditable
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    editorRef.current.innerHTML = initialHtml;
    setCharCount(editorRef.current.innerText.trim().length);
  }, [initialHtml]);

  const execFormat = (command: string, value: string | undefined = undefined) => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    updateContent();
  };

  const insertText = (text: string) => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, text);
    updateContent();
  };

  const handlePaste = () => {
    // ContentEditable preserves bold tags from Word/web automatically.
    // Allow slight timeout so DOM reflects pasted nodes then update
    setTimeout(() => {
      updateContent();
    }, 10);
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Editor Clean Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '6px 10px',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          borderRadius: '8px 8px 0 0',
          boxShadow: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {/* Bold button */}
          <button
            type="button"
            title="Bold (Cmd+B / Ctrl+B)"
            disabled={disabled}
            onClick={() => execFormat('bold')}
            style={{
              width: '26px',
              height: '26px',
              border: '1px solid var(--border-color)',
              borderRadius: '5px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',
            }}
          >
            B
          </button>

          {/* Italic button */}
          <button
            type="button"
            title="Italic (Cmd+I / Ctrl+I)"
            disabled={disabled}
            onClick={() => execFormat('italic')}
            style={{
              width: '26px',
              height: '26px',
              border: '1px solid var(--border-color)',
              borderRadius: '5px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',
            }}
          >
            I
          </button>

          <span style={{ color: 'var(--border-color)', margin: '0 2px' }}>|</span>

          {/* Quick Real Estate Shortcuts */}
          <button
            type="button"
            title="Add Hashtag"
            disabled={disabled}
            onClick={() => insertText('#')}
            style={{
              padding: '2px 7px',
              height: '26px',
              border: '1px solid var(--border-color)',
              borderRadius: '5px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: 'none',
            }}
          >
            #
          </button>

          <button
            type="button"
            title="Sparkles"
            disabled={disabled}
            onClick={() => insertText('✨ ')}
            style={{
              width: '26px',
              height: '26px',
              border: '1px solid var(--border-color)',
              borderRadius: '5px',
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '0.75rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',
            }}
          >
            ✨
          </button>

          <button
            type="button"
            title="Building"
            disabled={disabled}
            onClick={() => insertText('🏢 ')}
            style={{
              width: '26px',
              height: '26px',
              border: '1px solid var(--border-color)',
              borderRadius: '5px',
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '0.75rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',
            }}
          >
            🏢
          </button>

          <button
            type="button"
            title="Pin"
            disabled={disabled}
            onClick={() => insertText('📍 ')}
            style={{
              width: '26px',
              height: '26px',
              border: '1px solid var(--border-color)',
              borderRadius: '5px',
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '0.75rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',
            }}
          >
            📍
          </button>

          {onCopyFromOther && (
            <>
              <span style={{ color: 'var(--border-color)', margin: '0 2px' }}>|</span>
              <button
                type="button"
                onClick={onCopyFromOther}
                disabled={disabled}
                style={{
                  padding: '2px 8px',
                  height: '26px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '5px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  boxShadow: 'none',
                }}
              >
                {copyFromOtherLabel || 'Copy Content'}
              </button>
            </>
          )}
        </div>

        {/* Live Counter */}
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {charCount} characters
        </div>
      </div>

      {/* ContentEditable Box */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={updateContent}
        onBlur={updateContent}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{
          height: height || undefined,
          minHeight: height || minHeight,
          maxHeight: height || '380px',
          overflowY: 'auto',
          padding: '12px 14px',
          border: '1px solid var(--border-color)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          backgroundColor: 'var(--bg-main)',
          color: 'var(--text-primary)',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          opacity: disabled ? 0.6 : 1,
          boxShadow: 'none',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
    </div>
  );
};
