namespace K2Projects.Domain.Common;

/// <summary>Violação de uma regra de negócio do domínio, com código estável para tradução no frontend.</summary>
public class DomainException(string message, string code = "DOMAIN_RULE") : Exception(message)
{
    public string Code { get; } = code;
}
