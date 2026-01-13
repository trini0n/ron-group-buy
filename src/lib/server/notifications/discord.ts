/**
 * Discord DM channel implementation
 * Sends direct messages to users via Discord bot
 */

import { DISCORD_BOT_TOKEN } from '$env/static/private';
import type { SendResult } from './types';
import { logger } from '$lib/server/logger';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordChannel {
  id: string;
  type: number;
}

/**
 * Creates a DM channel with a user
 * Required before sending DMs to a user for the first time
 */
async function createDMChannel(discordUserId: string): Promise<string | null> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: discordUserId })
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ discordUserId, status: response.status, error }, 'Failed to create DM channel');
      return null;
    }

    const channel: DiscordChannel = await response.json();
    return channel.id;
  } catch (err) {
    logger.error({ discordUserId, error: err }, 'Exception creating DM channel');
    return null;
  }
}

/**
 * Sends a message to a Discord channel
 */
async function sendMessage(
  channelId: string, 
  content: string, 
  embed?: DiscordEmbed
): Promise<SendResult> {
  try {
    const body: Record<string, unknown> = { content };
    if (embed) {
      body.embeds = [embed];
    }

    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Check for specific error codes
      if (response.status === 403) {
        return { 
          success: false, 
          error: 'User has DMs disabled or has blocked the bot' 
        };
      }
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        return { 
          success: false, 
          error: `Rate limited. Retry after ${retryAfter}s` 
        };
      }

      return { success: false, error: `Discord API error: ${response.status} - ${errorText}` };
    }

    const message = await response.json();
    return { success: true, messageId: message.id };
  } catch (err) {
    logger.error({ channelId, error: err }, 'Exception sending Discord message');
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Sends a Discord DM to a user
 * 
 * @param discordUserId - The user's Discord ID (snowflake)
 * @param message - The message content to send
 * @param embed - Optional rich embed
 * @returns SendResult indicating success/failure
 */
export async function sendDiscordDM(
  discordUserId: string, 
  message: string, 
  embed?: DiscordEmbed
): Promise<SendResult> {
  if (!DISCORD_BOT_TOKEN) {
    logger.warn({}, 'DISCORD_BOT_TOKEN not configured, skipping DM');
    return { success: false, error: 'Discord bot not configured' };
  }

  if (!discordUserId) {
    return { success: false, error: 'No Discord user ID provided' };
  }

  // Create DM channel
  const channelId = await createDMChannel(discordUserId);
  if (!channelId) {
    return { success: false, error: 'Failed to create DM channel' };
  }

  // Send message
  return await sendMessage(channelId, message, embed);
}

/**
 * Check if Discord bot is configured
 */
export function isDiscordConfigured(): boolean {
  return !!DISCORD_BOT_TOKEN;
}
