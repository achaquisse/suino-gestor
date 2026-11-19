@animals
Feature: Animal management
  In order to keep the herd register complete
  As the owner
  I need to add purchased animals and correct animal details

  Background:
    Given I am signed in as the owner

  @smoke @mutation @ANI-01
  Scenario: Buy animals into a pen
    When I open the pen "Gestação"
    And I note the herd KPI "Ocupação"
    And I click the button "Comprar"
    And I fill "Quantidade" with "2"
    And I select "Leitoa" in "Fase"
    And I fill "Peso médio (kg)" with "120"
    And I fill "Valor total (MT)" with "30000"
    And I submit the sheet with "Registar compra"
    Then I should see the toast "2 animais registados · Gestação"
    And the herd KPI "Ocupação" should have increased by 2

  @ANI-02
  Scenario: Buying more animals than the pen can hold is refused
    When I open the pen "Varrasco"
    And I click the button "Comprar"
    And I fill "Quantidade" with "5"
    And I fill "Peso médio (kg)" with "200"
    And I fill "Valor total (MT)" with "90000"
    And I submit the sheet with "Registar compra"
    Then the sheet should show the error "Varrasco só tem 1 lugar livre."

  @mutation @ANI-03
  Scenario: Edit the notes of an animal
    When I open the animal "G-102"
    And I click the button "Editar"
    And I fill "Notas" with "Comprado em Boane, dócil"
    And I submit the sheet with "Guardar alterações"
    Then I should see the toast "Animal actualizado"
    And I should see "Comprado em Boane, dócil"

  @ANI-04
  Scenario: A duplicate ear tag is refused
    When I open the animal "G-106"
    And I click the button "Editar"
    And I fill "Brinco" with "G-107"
    And I submit the sheet with "Guardar alterações"
    Then the sheet should show the error "O brinco G-107 já existe."
