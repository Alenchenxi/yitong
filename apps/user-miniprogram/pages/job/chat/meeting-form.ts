export interface MeetingForm {
  meetingUrl: string;
  title: string;
  meetingDate: string;
  meetingTime: string;
  meetingNo: string;
  password: string;
  interviewerName: string;
}

export type ParsedMeetingFields = {
  [Field in keyof MeetingForm]: string | null;
};

export const EMPTY_MEETING_FORM: MeetingForm = {
  meetingUrl: '',
  title: '',
  meetingDate: '',
  meetingTime: '',
  meetingNo: '',
  password: '',
  interviewerName: '',
};

export function normalizeMeetingSource(source: string) {
  return source.trim();
}

export function mergeParsedMeetingForm(
  parsed: ParsedMeetingFields,
  current: MeetingForm,
  preserveManualValues: boolean,
): MeetingForm {
  const fallback = preserveManualValues ? current : EMPTY_MEETING_FORM;
  return {
    meetingUrl: parsed.meetingUrl ?? fallback.meetingUrl,
    title: parsed.title ?? fallback.title,
    meetingDate: parsed.meetingDate ?? fallback.meetingDate,
    meetingTime: parsed.meetingTime ?? fallback.meetingTime,
    meetingNo: parsed.meetingNo ?? fallback.meetingNo,
    password: parsed.password ?? fallback.password,
    interviewerName: parsed.interviewerName ?? fallback.interviewerName,
  };
}
