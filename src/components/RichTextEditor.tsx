import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { Mark, mergeAttributes } from '@tiptap/core';
import { MessageCircle, Bell } from 'lucide-react';
import { mockTeamMembers } from '../data/insightsData';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

// Custom Comment mark for italicized, light blue text
const CommentMark = Mark.create({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-comment': 'true',
      class: 'italic text-[#4ECDC4]', // Light teal/blue color from brand
    }), 0];
  },

  addCommands() {
    return {
      setComment: () => ({ commands }) => {
        return commands.setMark(this.name);
      },
      toggleComment: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
      unsetComment: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onCommentCountChange?: (count: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ 
  content, 
  onChange, 
  onCommentCountChange,
  placeholder = 'Add your notes here...',
  disabled = false 
}: RichTextEditorProps) {
  // Track if the update is coming from user typing (to prevent feedback loop)
  const isInternalUpdate = useRef(false);
  // Track the last content we set to avoid unnecessary updates
  const lastExternalContent = useRef(content);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      CommentMark,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention text-[#FF6B35] bg-[#FF6B35]/10 px-1 rounded',
        },
        suggestion: {
          items: ({ query }) => {
            return mockTeamMembers
              .filter(member => 
                member.name.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 5);
          },
          render: () => {
            let component: any;
            let popup: TippyInstance[];

            return {
              onStart: (props: any) => {
                component = new MentionList(props);

                if (!props.clientRect) {
                  return;
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  theme: 'dark',
                });
              },

              onUpdate(props: any) {
                component.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },

              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }

                return component.onKeyDown(props);
              },

              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // Mark this as an internal update to prevent useEffect from resetting content
      isInternalUpdate.current = true;
      const html = editor.getHTML();
      onChange(html);
      
      // Count comments and mentions
      if (onCommentCountChange) {
        const doc = editor.state.doc;
        let commentCount = 0;
        doc.descendants((node) => {
          if (node.marks.some(mark => mark.type.name === 'comment')) {
            commentCount++;
          }
          if (node.type.name === 'mention') {
            commentCount++;
          }
        });
        onCommentCountChange(commentCount);
      }
      
      // Reset the flag after a brief delay (after React state updates)
      requestAnimationFrame(() => {
        isInternalUpdate.current = false;
      });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] text-[#9CA3AF] px-4 py-3',
      },
    },
  });

  // Only update editor content when it's an external change (not from user typing)
  useEffect(() => {
    if (editor && !isInternalUpdate.current && content !== lastExternalContent.current) {
      lastExternalContent.current = content;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const toggleCommentMode = () => {
    if (editor) {
      editor.chain().focus().toggleComment().run();
    }
  };

  // Count comments/mentions for notification badge
  const getCommentMentionCount = () => {
    if (!editor) return 0;
    
    const doc = editor.state.doc;
    let count = 0;
    doc.descendants((node) => {
      if (node.marks.some(mark => mark.type.name === 'comment')) {
        count++;
      }
      if (node.type.name === 'mention') {
        count++;
      }
    });
    return count;
  };

  const commentMentionCount = getCommentMentionCount();

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Comment Button - Top Right */}
      <button
        onClick={toggleCommentMode}
        disabled={disabled}
        className="absolute top-2 right-2 z-10 p-2 bg-[#2A2A2A] hover:bg-[#FF6B35] text-white rounded-full transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        title="Add comment (select text and click)"
      >
        <MessageCircle className="w-4 h-4" />
      </button>

      {/* Notification Badge - Top Right (below comment button) */}
      {commentMentionCount > 0 && (
        <div className="absolute top-14 right-2 z-10 flex items-center gap-1 px-2 py-1 bg-[#FF6B35] text-white rounded-full text-xs">
          <Bell className="w-3 h-3" />
          <span>{commentMentionCount}</span>
        </div>
      )}

      {/* TipTap Editor */}
      <EditorContent 
        editor={editor} 
        className="flex-1 overflow-y-auto bg-[#212121] rounded-lg"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      />

      <style>{`
        .ProseMirror {
          min-height: 300px;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #6B7280;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .mention {
          color: #FF6B35;
          background-color: rgba(255, 107, 53, 0.1);
          padding: 0 4px;
          border-radius: 4px;
        }
        [data-comment="true"] {
          font-style: italic;
          color: #4ECDC4;
        }
      `}</style>
    </div>
  );
}

// Mention List Component for Dropdown
class MentionList {
  items: any[];
  component: HTMLElement;
  selectedIndex: number;
  element: HTMLElement;

  constructor(props: any) {
    this.items = props.items;
    this.selectedIndex = 0;

    this.element = document.createElement('div');
    this.element.className = 'bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg shadow-lg overflow-hidden';

    this.render();
  }

  render() {
    if (this.items.length === 0) {
      this.element.innerHTML = '<div class="px-4 py-2 text-sm text-[#6B7280]">No members found</div>';
      return;
    }

    this.element.innerHTML = this.items
      .map((item, index) => {
        return `
          <button 
            class="mention-item w-full text-left px-4 py-2 text-sm text-white hover:bg-[#FF6B35] transition-colors ${
              index === this.selectedIndex ? 'bg-[#FF6B35]' : ''
            }"
            data-index="${index}"
          >
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center text-xs text-white">
                ${item.avatar}
              </div>
              <span>${item.name}</span>
            </div>
          </button>
        `;
      })
      .join('');

    // Add click handlers
    const buttons = this.element.querySelectorAll('.mention-item');
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => {
        this.selectItem(index);
      });
    });
  }

  updateProps(props: any) {
    this.items = props.items;
    this.render();
  }

  onKeyDown({ event }: { event: KeyboardEvent }) {
    if (event.key === 'ArrowUp') {
      this.upHandler();
      return true;
    }

    if (event.key === 'ArrowDown') {
      this.downHandler();
      return true;
    }

    if (event.key === 'Enter') {
      this.enterHandler();
      return true;
    }

    return false;
  }

  upHandler() {
    this.selectedIndex = ((this.selectedIndex + this.items.length) - 1) % this.items.length;
    this.render();
  }

  downHandler() {
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    this.render();
  }

  enterHandler() {
    this.selectItem(this.selectedIndex);
  }

  selectItem(index: number) {
    const item = this.items[index];

    if (item) {
      // This will be called by TipTap's suggestion plugin
      (this.element as any).dispatchEvent(
        new CustomEvent('select-mention', { detail: item })
      );
    }
  }

  destroy() {
    this.element.remove();
  }
}