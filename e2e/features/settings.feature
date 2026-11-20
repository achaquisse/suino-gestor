@settings
Feature: Settings
  In order to adapt the app to my farm
  As the owner
  I need to manage accounts and my team, while other roles see less

  @smoke @rbac @SET-01
  Scenario: The owner sees all settings tabs
    Given I am signed in as the owner
    When I open "/settings"
    Then I should see the tabs:
      | tab            |
      | Geral          |
      | Currais        |
      | Contas         |
      | Parâmetros     |

  @rbac @SET-02
  Scenario: The caretaker does not see finance settings
    Given I am signed in as the caretaker
    When I open "/settings"
    Then I should see the tabs:
      | tab   |
      | Geral |
    But I should not see the tabs:
      | tab            |
      | Contas         |
      | Tipos de custo |

  @mutation @SET-03
  Scenario: Create a funding account
    Given I am signed in as the owner
    When I open "/settings?tab=accounts"
    And I click the button "Nova conta"
    And I fill "Nome" with "Conta E2E"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Conta criada"
    And I should see "Conta E2E"

  @SET-04
  Scenario: Inviting with an invalid email is refused
    Given I am signed in as the owner
    When I open "/settings"
    And I click the button "Convidar"
    And I fill "Nome" with "Rita Vet"
    And I fill "Email" with "rita-sem-arroba"
    And I submit the sheet with "Convidar"
    Then the sheet should show the error "Indique o nome e um email válido."

  @mutation @SET-05
  Scenario: Invite a team member
    Given I am signed in as the owner
    When I open "/settings"
    And I click the button "Convidar"
    And I fill "Nome" with "Rita Vet"
    And I fill "Email" with "rita.vet@suinogestor.test"
    And I select "Veterinário" in "Função"
    And I submit the sheet with "Convidar"
    Then I should see the toast "Convite enviado a Rita Vet"

  @mutation @SET-06
  Scenario: Register a pen with a role, no capacity limit and closed for use
    Given I am signed in as the owner
    When I open "/settings?tab=pens"
    Then I should see "Esquema dos currais"
    When I click the button "Novo curral"
    And I fill "Nome" with "Curral E2E"
    And I select "Quarentena" in "Função"
    And I switch on "Vedado"
    And I fill "Motivo" with "Obras"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Curral criado"
    And I should see "Curral E2E"
    And I should see "Quarentena · Obras"

  @rbac @SET-07
  Scenario: The caretaker sees the pen layout but cannot change it
    Given I am signed in as the caretaker
    When I open "/settings?tab=pens"
    Then I should see "Esquema dos currais"
    But I should not see the button "Novo curral"
