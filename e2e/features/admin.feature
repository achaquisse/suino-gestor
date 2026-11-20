@admin
Feature: Platform administration
  In order to run the platform
  As the super admin (SUPER_ADMIN_EMAIL)
  I need to create farms, see every farm and user, and open any farm

  @smoke @ADM-01
  Scenario: The super admin lands in the admin area with every farm
    Given I am signed in as the admin
    Then I should see the heading "Administração"
    And I should see the tabs:
      | tab            |
      | Granjas        |
      | Tipos de custo |
      | Catálogos      |
      | Utilizadores   |
    And the E2E demo farm should be listed with its owner

  @ADM-02
  Scenario: Search farms
    Given I am signed in as the admin
    When I search the admin farms for the E2E demo farm
    Then the admin farm list should show only the E2E demo farm

  @mutation @ADM-03
  Scenario: Create a farm for an owner who has no account yet
    Given I am signed in as the admin
    When I create the farm "Granja Convite" for the invitee
    Then I should see the toast for the new farm "Granja Convite"
    And the farm "Granja Convite" should be listed with the invitee as pending owner

  @ADM-04
  Scenario: A farm needs a name
    Given I am signed in as the admin
    When I try to create a farm without a name
    Then the sheet should show the error "Indique o nome da granja."

  @mutation @ADM-05
  Scenario: Rename and delete a farm
    Given I am signed in as the admin
    When I create the farm "Granja Temporária" for the invitee
    And I rename the farm "Granja Temporária" to "Granja Renomeada"
    Then I should see the toast "Granja renomeada"
    And the farm "Granja Renomeada" should be listed
    When I delete the farm "Granja Renomeada"
    Then the farm "Granja Renomeada" should not be listed

  @smoke @ADM-06
  Scenario: The super admin opens a farm they are not a member of
    Given I am signed in as the admin
    When I enter the E2E demo farm from the admin area
    Then I should be on a page whose URL contains "/herd"
    And the header should show the E2E demo farm
    And I should see "Modo administrador"
    And I should see the main navigation item "Despesas"
    When I click the button "Voltar à administração"
    Then I should be on a page whose URL contains "/admin"

  @ADM-07
  Scenario: The users tab lists every account and its farms
    Given I am signed in as the admin
    When I click the tab "Utilizadores"
    Then the users list should show the owner with the E2E demo farm
    And the users list should mark me as super admin

  @rbac @ADM-08
  Scenario: A farm owner cannot open the admin area
    Given I am signed in as the owner
    When I open "/admin"
    Then I should be on a page whose URL contains "/herd"
    And I should not see "Modo administrador"

  @rbac @ADM-09
  Scenario: A farm owner cannot create farms
    Given I am signed in as the owner
    When I open "/settings"
    Then I should see the heading "Granjas"
    And I should not see the button "Nova granja"
    And I should not see the button "Administração"

  @ADM-10
  Scenario: The super admin manages a farm's cost types
    Given I am signed in as the admin
    When I open the cost types of the E2E demo farm
    Then I should see the heading "Tipos financeiros"
    And I should see "Ração"
    And I should see the button "Novo tipo"

  @ADM-11
  Scenario: The super admin manages a farm's catalogs
    Given I am signed in as the admin
    When I open the catalogs of the E2E demo farm
    Then I should see the heading "Produtos de tratamento"
    And I should see the heading "Raças"
    And I should see the heading "Sintomas"
    And I should see the button "Nova raça"

  @mutation @ADM-12
  Scenario: Deactivate, reactivate and remove a user account
    Given I am signed in as the admin
    When I click the tab "Utilizadores"
    And I open the spare account in the users list
    And I click the button "Desactivar conta"
    And I submit the sheet with "Desactivar"
    Then I should see the toast "Conta desactivada"
    And I should see the button "Activar conta"
    When I click the button "Activar conta"
    Then I should see the toast "Conta activada"
    When I click the button "Remover conta"
    And I submit the sheet with "Remover"
    Then I should see the toast "Conta removida"
    And the spare account should not be listed

  @ADM-13
  Scenario: The admin sees what a user did
    Given I am signed in as the admin
    When I click the tab "Utilizadores"
    And I open the admin account in the users list
    Then the breadcrumb should show "Ana Admin"
    And I should see the heading "Actividade"
    And I should see "operações"
    And I should see "Criou"
    But I should not see the button "Desactivar conta"

  @ADM-14
  Scenario: Search, filter, sort and page a user's activity
    Given I am signed in as the admin
    When I click the tab "Utilizadores"
    And I open the admin account in the users list
    And I filter the activity by "Criações" in "Operação"
    And I filter the activity by "Granja" in "Tipo de registo"
    And I search the activity for "E2E"
    Then I should see "Criou granja"
    And I should be on a page whose URL contains "op=insert"
    When I filter the activity by "Mais antigas" in "Ordenar"
    Then I should be on a page whose URL contains "sort=old"
    When I search the activity for "nada-assim-xyz"
    Then I should see "Nenhuma operação encontrada"
