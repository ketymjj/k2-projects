using K2Projects.Application.Common;
using K2Projects.Application.Dashboard;
using K2Projects.Application.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace K2Projects.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(NotificationService notifications) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<NotificationDto>> List([FromQuery] NotificationQuery query, CancellationToken ct) => notifications.ListAsync(query, ct);

    [HttpGet("unread-count")]
    public async Task<object> UnreadCount(CancellationToken ct) => new { count = await notifications.UnreadCountAsync(ct) };

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await notifications.MarkReadAsync(id, ct);
        return NoContent();
    }

    [HttpPatch("read-all")]
    public async Task<object> MarkAllRead(CancellationToken ct) => new { updated = await notifications.MarkAllReadAsync(ct) };
}

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(DashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public Task<DashboardDto> Get(CancellationToken ct) => dashboard.GetAsync(ct);
}
