import React, { useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Digite sua mensagem aqui...',
  rows = 6,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const formatText = (formatter: string) => {
    // Get selected text
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let formattedText = '';
    switch (formatter) {
      case 'bold':
        formattedText = `*${selectedText}*`;
        break;
      case 'italic':
        formattedText = `_${selectedText}_`;
        break;
      case 'strikethrough':
        formattedText = `~${selectedText}~`;
        break;
      case 'link':
        // Prompt user for URL
        const url = prompt('Enter URL:');
        if (url) {
          formattedText = selectedText ? `[${selectedText}](${url})` : url;
        } else {
          return;
        }
        break;
      default:
        return;
    }

    // Replace selected text with formatted text
    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + formattedText.length,
        start + formattedText.length
      );
    }, 0);
  };

  const addEmoji = (emoji: any) => {
    onChange(value + emoji.native);
    setShowEmojiPicker(false);
  };

  return (
    <div className="border border-gray-300 rounded-md">
      {/* Toolbar */}
      <div className="flex items-center border-b border-gray-300 p-2">
        <button
          type="button"
          className="p-1 text-gray-500 hover:text-gray-700 mr-1"
          onClick={() => formatText('bold')}
          title="Bold (WhatsApp: *text*)"
        >
          <i className="fas fa-bold"></i>
        </button>
        <button
          type="button"
          className="p-1 text-gray-500 hover:text-gray-700 mr-1"
          onClick={() => formatText('italic')}
          title="Italic (WhatsApp: _text_)"
        >
          <i className="fas fa-italic"></i>
        </button>
        <button
          type="button"
          className="p-1 text-gray-500 hover:text-gray-700 mr-1"
          onClick={() => formatText('strikethrough')}
          title="Strikethrough (WhatsApp: ~text~)"
        >
          <i className="fas fa-strikethrough"></i>
        </button>
        <button
          type="button"
          className="p-1 text-gray-500 hover:text-gray-700 mr-1"
          onClick={() => formatText('link')}
          title="Link"
        >
          <i className="fas fa-link"></i>
        </button>
        <div className="h-4 w-px bg-gray-300 mx-1"></div>
        
        {/* Emoji picker */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Emoji"
            >
              <i className="far fa-smile"></i>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0 border-none" align="start" side="bottom">
            <Picker 
              data={data} 
              onEmojiSelect={addEmoji}
              previewPosition="none"
              skinTonePosition="none"
              theme="light"
            />
          </PopoverContent>
        </Popover>
        
        {/* File attachment (disabled for now) */}
        <button
          type="button"
          className="p-1 text-gray-500 hover:text-gray-700 opacity-50 cursor-not-allowed"
          title="File attachment (Disabled)"
          disabled
        >
          <i className="fas fa-paperclip"></i>
        </button>
      </div>
      
      {/* Text area */}
      <textarea
        className="w-full p-3 text-sm focus:outline-none resize-none"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      ></textarea>
    </div>
  );
};

export default RichTextEditor;
