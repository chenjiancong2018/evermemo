import type { Metadata } from 'next';
import { AiAssistantView } from '@/components/ai/AiAssistantView';

export const metadata: Metadata = { title: 'AI 助手 · Evermemo' };

export default function AiPage() {
  return <AiAssistantView />;
}
