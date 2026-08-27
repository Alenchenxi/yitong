import { HttpStatus } from '@nestjs/common';
import { BizException } from '../../common/exceptions/biz.exception';

export interface ParsedTencentMeeting {
  meetingUrl: string;
  title: string | null;
  meetingDate: string | null;
  meetingTime: string | null;
  meetingNo: string | null;
  password: string | null;
  interviewerName: string | null;
}

export function assertTencentMeetingUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BizException(40006, '请输入有效的腾讯会议链接', HttpStatus.BAD_REQUEST);
  }
  const host = url.hostname.toLowerCase();
  const official = host === 'meeting.tencent.com' || host.endsWith('.meeting.tencent.com') || host === 'voovmeeting.com' || host.endsWith('.voovmeeting.com');
  if (url.protocol !== 'https:' || !official) {
    throw new BizException(40006, '仅支持腾讯会议官方链接', HttpStatus.BAD_REQUEST);
  }
  return url.toString().replace(/\/$/, '');
}

export function parseTencentMeetingShare(input: string): ParsedTencentMeeting {
  const text = input.trim();
  const urlMatch = text.match(/https:\/\/[^\s，。！？；、）)\]}]+/i);
  if (!urlMatch) throw new BizException(40006, '未识别到腾讯会议链接', HttpStatus.BAD_REQUEST);
  const meetingUrl = assertTencentMeetingUrl(urlMatch[0]);
  const line = (labels: string[]) => {
    const pattern = new RegExp(`(?:${labels.join('|')})[：:]\\s*([^\\r\\n]+)`, 'i');
    return text.match(pattern)?.[1]?.trim() ?? null;
  };
  const dateTime = text.match(/(?:会议时间|面试时间)[：:]\s*(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}:\d{2})/);
  const meetingDate =
    dateTime?.[1] && dateTime[2] && dateTime[3]
      ? `${dateTime[1]}-${dateTime[2].padStart(2, '0')}-${dateTime[3].padStart(2, '0')}`
      : null;
  return {
    meetingUrl,
    title: line(['腾讯会议', '会议主题', '面试标题', '主题']),
    meetingDate,
    meetingTime: dateTime?.[4] ?? null,
    meetingNo: line(['会议号'])?.replace(/\s+/g, '') ?? null,
    password: line(['会议密码', '密码']),
    interviewerName: line(['面试官', '主持人']),
  };
}
