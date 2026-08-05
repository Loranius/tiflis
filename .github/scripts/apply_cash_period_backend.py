from pathlib import Path
import re

path = Path('supabase/functions/tiflis-secure-api/index.ts')
text = path.read_text()

pattern = re.compile(
    r'    if \(action === "cash_bootstrap"\) \{.*?\n    \}\n\n    if \(action === "cash_save_day" \|\| action === "cash_delete_day"\)',
    re.S,
)

replacement = r'''    if (action === "cash_bootstrap") {
      if (!canUseCash(profile)) return json(req, { ok: false, error: "Cash access denied" }, 403);
      const range = parseMonth(body.month);
      if (!range) return json(req, { ok: false, error: "Invalid month" }, 400);

      const rawLeaderboardPeriod = typeof body.leaderboard_period === "string" ? body.leaderboard_period : "first";
      const leaderboardPeriod = ["first", "second", "month", "year"].includes(rawLeaderboardPeriod)
        ? rawLeaderboardPeriod
        : "first";
      const [yearText = "", monthText = ""] = range.month.split("-");
      const selectedYear = Number(yearText);
      const selectedMonth = Number(monthText);
      const monthLastDay = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
      const isoForDay = (day: number) => `${range.month}-${String(day).padStart(2, "0")}`;
      const leaderboardStart = leaderboardPeriod === "year" ? `${selectedYear}-01-01` : range.start;
      const leaderboardEnd = leaderboardPeriod === "year" ? `${selectedYear + 1}-01-01` : range.end;

      const usersResult = await serviceClient
        .from("users")
        .select("id,login,display_name,role,role2,avatar,fired")
        .or("fired.is.null,fired.eq.false")
        .order("display_name", { ascending: true });
      if (usersResult.error) throw usersResult.error;
      const allUsers = (usersResult.data ?? []) as LegacyStaff[];
      const currentStaff = allUsers.find((staff) => staff.id === profile.legacy_user_id);
      if (!currentStaff) return json(req, { ok: false, error: "Staff member not found" }, 404);

      const requestedUserId = typeof body.user_id === "string" ? body.user_id.trim().slice(0, 120) : "";
      const requestedStaff = allUsers.find((staff) => staff.id === requestedUserId);
      const viewStaff = isAdmin(profile) && requestedStaff ? requestedStaff : currentStaff;

      const [cashResult, extrasResult, leaderboardCashResult, leaderboardExtrasResult, ratingsResult, commentsResult] = await Promise.all([
        serviceClient.from("cash").select("id,user_id,date,cash,tips,first_cash").gte("date", range.start).lt("date", range.end).order("date", { ascending: true }),
        serviceClient.from("extra_wages").select("id,user_id,date,amount,description").eq("user_id", viewStaff.id).gte("date", range.start).lt("date", range.end).order("date", { ascending: true }),
        serviceClient.from("cash").select("id,user_id,date,cash,tips,first_cash").gte("date", leaderboardStart).lt("date", leaderboardEnd).order("date", { ascending: true }),
        serviceClient.from("extra_wages").select("id,user_id,date,amount,description").gte("date", leaderboardStart).lt("date", leaderboardEnd).order("date", { ascending: true }),
        serviceClient.from("ratings").select("user_id,score"),
        serviceClient.from("rating_comments").select("id,user_id,author,delta,comment,text,created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      if (cashResult.error) throw cashResult.error;
      if (extrasResult.error) throw extrasResult.error;
      if (leaderboardCashResult.error) throw leaderboardCashResult.error;
      if (leaderboardExtrasResult.error) throw leaderboardExtrasResult.error;
      if (ratingsResult.error) throw ratingsResult.error;
      if (commentsResult.error) throw commentsResult.error;

      const cashRows = (cashResult.data ?? []) as CashRow[];
      const leaderboardCashRows = (leaderboardCashResult.data ?? []) as CashRow[];
      const leaderboardExtraRows = (leaderboardExtrasResult.data ?? []) as ExtraWageRow[];
      const cashStaff = allUsers.filter(isCashStaff);
      const selectorUsers = isAdmin(profile)
        ? [...new Map([...cashStaff, currentStaff].map((staff) => [staff.id, staff])).values()]
        : [currentStaff];

      const includeCashDate = (date: string): boolean => {
        if (leaderboardPeriod === "first") return date >= isoForDay(1) && date <= isoForDay(Math.min(14, monthLastDay));
        if (leaderboardPeriod === "second") return date >= isoForDay(Math.min(15, monthLastDay)) && date < range.end;
        return true;
      };
      const includeBaseDate = (date: string): boolean => {
        if (leaderboardPeriod === "first") return date >= isoForDay(1) && date <= isoForDay(Math.min(15, monthLastDay));
        if (leaderboardPeriod === "second") return date >= isoForDay(Math.min(16, monthLastDay)) && date < range.end;
        return true;
      };
      const includeExtraDate = includeBaseDate;

      const totals = cashStaff.map((staff) => {
        const staffCashRows = leaderboardCashRows.filter((row) => row.user_id === staff.id);
        const cashForPercent = staffCashRows
          .filter((row) => includeCashDate(row.date))
          .reduce((sum, row) => sum + numberOf(row.first_cash ?? row.cash), 0);
        const workDays = staffCashRows.filter((row) => {
          return includeBaseDate(row.date) && (numberOf(row.cash) > 0 || numberOf(row.tips) > 0);
        }).length;
        const extras = leaderboardExtraRows
          .filter((row) => row.user_id === staff.id && includeExtraDate(row.date))
          .reduce((sum, row) => sum + numberOf(row.amount), 0);
        return { staff, total: cashForPercent * 0.04 + workDays * 200 + extras };
      }).sort((left, right) => right.total - left.total || (left.staff.display_name || left.staff.login).localeCompare(right.staff.display_name || right.staff.login, "uk"));
      const maxTotal = totals[0]?.total || 0;
      const leaderboard = totals.map(({ staff, total }, index) => ({
        userId: staff.id,
        name: staff.display_name || staff.login,
        rank: index + 1,
        total: isAdmin(profile) || staff.id === profile.legacy_user_id ? Math.round(total * 100) / 100 : null,
        relative: maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0,
        mine: staff.id === profile.legacy_user_id,
      }));

      const ratingMap = new Map(((ratingsResult.data ?? []) as RatingRow[]).map((rating) => [rating.user_id || "", rating.score || 0]));
      const commentsByUser = new Map<string, RatingCommentRow[]>();
      for (const comment of (commentsResult.data ?? []) as RatingCommentRow[]) {
        if (!comment.user_id) continue;
        const list = commentsByUser.get(comment.user_id) ?? [];
        if (list.length < 3) list.push({ ...comment, comment: comment.comment || comment.text || null });
        commentsByUser.set(comment.user_id, list);
      }
      const ratings = allUsers.filter(isRatingStaff).map((staff) => ({
        userId: staff.id,
        name: staff.display_name || staff.login,
        role: normalizeRole(staff.role),
        score: ratingMap.get(staff.id) ?? 0,
        comments: commentsByUser.get(staff.id) ?? [],
      })).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "uk"));

      return json(req, {
        ok: true,
        month: range.month,
        leaderboardPeriod,
        viewUserId: viewStaff.id,
        me: {
          legacyUserId: profile.legacy_user_id,
          canViewAll: isAdmin(profile),
          canEditAll: isAdmin(profile),
          canEditRatings: isAdmin(profile),
        },
        users: selectorUsers.map((staff) => ({
          id: staff.id,
          name: staff.display_name || staff.login,
          role: normalizeRole(staff.role),
          role2: staff.role2 ? normalizeRole(staff.role2) : null,
          avatar: staff.avatar,
        })),
        entries: cashRows.filter((row) => row.user_id === viewStaff.id),
        extraWages: (extrasResult.data ?? []) as ExtraWageRow[],
        leaderboard,
        ratings,
      });
    }

    if (action === "cash_save_day" || action === "cash_delete_day")'''

text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('Could not replace cash bootstrap block')
path.write_text(text)
