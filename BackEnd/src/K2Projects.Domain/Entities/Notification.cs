using K2Projects.Domain.Enums;

namespace K2Projects.Domain.Entities;

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public Guid? RelatedTaskId { get; set; }
    public WorkTask? RelatedTask { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Parâmetros do evento em JSON (ex.: {"task":"...","project":"..."}), usados pelo frontend para montar
    /// o texto no idioma do usuário. Title/Message continuam gravados em português como texto de reserva.
    /// </summary>
    public string? Args { get; set; }

    /// <summary>Chave usada para evitar notificações duplicadas para o mesmo evento (ex.: prazo próximo).</summary>
    public string? DedupKey { get; set; }
}
