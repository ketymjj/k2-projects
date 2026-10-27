using K2Projects.Application.Auth;
using K2Projects.Application.Common;
using K2Projects.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace K2Projects.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AuthService auth, ICurrentUser currentUser) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public Task<AuthResponse> Login(LoginRequest request, CancellationToken ct) => auth.LoginAsync(request, ct);

    [HttpGet("me")]
    [Authorize]
    public Task<UserDto> Me(CancellationToken ct) => auth.MeAsync(currentUser.UserId, ct);

    /// <summary>JWT é stateless: o logout descarta o token no cliente. O endpoint existe para registro/auditoria.</summary>
    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout() => NoContent();
}
